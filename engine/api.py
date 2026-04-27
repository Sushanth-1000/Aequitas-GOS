import json
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import pickle
import shap
import random
from typing import Optional

from core.policy import enforce_policy
from core.explainability import generate_explanation
from core.logger import log_to_firestore, generate_pdf_report
from core.bias_calculator import calculate_fairness_metrics, calculate_multidimensional_fairness
from core.bias_detector import detect_bias_hybrid, compute_counterfactual_gap
from core.bias_corrector import cafp_correct

app = FastAPI(title="Aequitas-Gov API")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# Load Models
try:
    with open('models/model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('models/explainer.pkl', 'rb') as f:
        explainer = pickle.load(f)
    with open('models/features.pkl', 'rb') as f:
        features = pickle.load(f)
    df = pd.read_csv('data/synthetic_applicants.csv')
except Exception as e:
    print(f"Error loading models or data: {e}")
    model, explainer, features, df = None, None, None, None

# --- Mutable Policy Engine State ---
policy_state = {
    "active_mode": "enforcement",
    "threshold": 0.65,
    "counterfactual_adjustments": {
        "Female": {
            "Income": {"op": "divide", "value": 0.85},
            "Credit_Score": {"op": "add", "value": 50}
        },
        "Non-Binary": {
            "Income": {"op": "divide", "value": 0.90},
            "Credit_Score": {"op": "add", "value": 30}
        },
        "Male": {}
    },
    "counterfactual_threshold": 0.05,
    "decision_rules": [
        {
            "rule_id": "R001", "name": "Gender Bias Correction (All Protected)", "priority": 1,
            "condition": {"metric": "DIR", "operator": "<", "value": 0.8, "target_group": "Gender=All-Protected"},
            "action": {"type": "score_multiplier", "value": 1.15}, "enabled": True
        },
        {
            "rule_id": "R002", "name": "Non-Binary Additional Boost", "priority": 2,
            "condition": {"metric": "DIR", "operator": "<", "value": 0.8, "target_group": "Gender=Non-Binary"},
            "action": {"type": "score_additive", "value": 0.05}, "enabled": True
        },
        {
            "rule_id": "R003", "name": "Zip Code Proxy Detection", "priority": 3,
            "condition": {"metric": "DIR", "operator": "<", "value": 0.85, "target_group": "ZipCode=Proxy"},
            "action": {"type": "score_additive", "value": 0.03}, "enabled": True
        }
    ]
}

# --- Cached fairness metrics (recomputed on policy change) ---
_cached_fairness = None
_cached_multidim = None

def recompute_fairness_cache():
    """Recompute fairness metrics from the full dataset."""
    global _cached_fairness, _cached_multidim
    if model is None or df is None:
        return
    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    X = df[model_features]
    scores = model.predict_proba(X)[:, 0].tolist()
    groups = df['Gender'].tolist()
    _cached_fairness = calculate_fairness_metrics(scores, groups, policy_state["threshold"])
    _cached_multidim = calculate_multidimensional_fairness(df, model, policy_state["threshold"])

# Compute on startup
try:
    recompute_fairness_cache()
except:
    pass

# --- Mock Names ---
MOCK_FIRST_NAMES = ["Alex","Jordan","Taylor","Morgan","Casey","Sam","Jamie","Riley","Cameron","Avery","Mia","David","Elena","Liam","Sofia","Noah","Emma"]
MOCK_LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Chen","Patel","Nguyen","Kim","O'Connor"]
def get_deterministic_name(seed_string: str) -> str:
    random.seed(seed_string)
    return f"{random.choice(MOCK_FIRST_NAMES)} {random.choice(MOCK_LAST_NAMES)}"

# --- Data Models ---
class SimulateRequest(BaseModel):
    income: float; creditScore: int; age: int; dti: float; loanAmount: float
    employmentYears: float; gender: str; zipCode: str; applicantId: str; governanceActive: bool

class ExplainRequest(BaseModel):
    applicant_id: str; original_score: float; policy_rule: str; final_decision: str; top_feature: str

class AuditRequest(BaseModel):
    applicant_id: str; original_score: float; adjusted_score: float; final_decision: bool; policy_applied: str

class PolicyUpdateRequest(BaseModel):
    threshold: Optional[float] = None
    counterfactual_adjustments: Optional[dict] = None
    counterfactual_threshold: Optional[float] = None
    decision_rules: Optional[list] = None

# --- Helper Functions ---

def get_enforce_rules():
    return {
        "active_mode": policy_state["active_mode"],
        "threshold": policy_state["threshold"],
        "decision_rules": [r for r in policy_state["decision_rules"] if r.get("enabled", True)]
    }

def run_inference(applicant_dict: dict, governance_active: bool):
    """Full pipeline: Score → SHAP → Bias Detect (counterfactual) → Bias Correct (CAFP)."""
    threshold = policy_state["threshold"]
    cf_adjustments = policy_state["counterfactual_adjustments"]
    cf_threshold = policy_state["counterfactual_threshold"]

    # 1. Model scoring
    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    infer_payload = pd.DataFrame([{f: applicant_dict[f] for f in model_features}])
    prob = float(model.predict_proba(infer_payload)[0][0])

    # 2. SHAP explainability
    X_trans = model.named_steps['preprocessor'].transform(infer_payload)
    shap_values_raw = explainer.shap_values(X_trans)
    val = shap_values_raw[0] if isinstance(shap_values_raw, list) else shap_values_raw[0]
    shap_list = [{"feature": features[i], "value": float(val[i])} for i in range(len(features))]

    # 3. Bias Detection (ALWAYS runs — counterfactual + subgroup)
    detection = detect_bias_hybrid(
        applicant_dict, model, df, threshold, cf_adjustments, cf_threshold
    )
    is_biased = detection["is_biased"]
    cf_score = detection["counterfactual"]["counterfactual_score"]
    cf_gap = detection["counterfactual"]["gap"]

    # 4. Bias Correction (CAFP — only when governance ON)
    if governance_active and is_biased:
        adjusted_score = cafp_correct(prob, cf_score)
        final_decision = adjusted_score >= threshold
        applied_rule = "CAFP"
    elif governance_active:
        # Not biased, still run old policy rules for any edge cases
        dir_metric = _cached_fairness["global_dir"] if _cached_fairness else 0.72
        final_decision, applied_rule, adjusted_score = enforce_policy(
            prob, dir_metric, applicant_dict, get_enforce_rules()
        )
    else:
        final_decision = prob >= threshold
        applied_rule = "None (Governance Off)"
        adjusted_score = prob

    # 5. Decision status
    if governance_active:
        if is_biased and final_decision:
            decision_status = "Auto-Corrected"
        elif is_biased and not final_decision:
            decision_status = "Needs Review"
        elif final_decision:
            decision_status = "Approved"
        else:
            decision_status = "Needs Review"
    else:
        if is_biased:
            decision_status = "Needs Review"
        elif final_decision:
            decision_status = "Approved"
        else:
            decision_status = "Needs Review"

    # 6. Correction detail
    correction_detail = None
    if is_biased:
        raw_decision = prob >= threshold
        correction_detail = {
            "beforeScore": prob,
            "beforeDecision": "Approved" if raw_decision else "Denied",
            "afterScore": adjusted_score if governance_active else prob,
            "afterDecision": "Approved" if (adjusted_score >= threshold and governance_active) else ("Approved" if raw_decision else "Denied"),
            "ruleApplied": applied_rule if governance_active else "None",
            "correctionApplied": governance_active,
            "counterfactualScore": cf_score,
            "counterfactualGap": cf_gap,
            "method": "CAFP" if governance_active else "None",
            "biasReasons": detection["reasons"]
        }

    return {
        "originalScore": prob,
        "adjustedScore": adjusted_score,
        "finalDecision": "Approved" if final_decision else "Denied",
        "appliedRule": applied_rule,
        "shapValues": shap_list,
        "rawDecisionBool": final_decision,
        "biasStatus": "Biased" if is_biased else "Non-Biased",
        "decisionStatus": decision_status,
        "correctionDetail": correction_detail,
        "counterfactualScore": cf_score,
        "counterfactualGap": cf_gap,
    }

# --- API Endpoints ---

@app.get("/api/applicants")
def get_applicants():
    if df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")

    sample = df.head(100).copy()
    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    threshold = policy_state["threshold"]
    cf_adjustments = policy_state["counterfactual_adjustments"]
    cf_threshold = policy_state["counterfactual_threshold"]

    # --- Batch score all 100 applicants at once ---
    X_batch = sample[model_features]
    probs = model.predict_proba(X_batch)[:, 0]

    # --- Batch SHAP ---
    X_trans = model.named_steps['preprocessor'].transform(X_batch)
    shap_vals_raw = explainer.shap_values(X_trans)
    shap_matrix = shap_vals_raw if not isinstance(shap_vals_raw, list) else shap_vals_raw

    results = []
    for i, (_, row) in enumerate(sample.iterrows()):
        applicant_dict = row.to_dict()
        prob = float(probs[i])

        # SHAP for this row
        val = shap_matrix[i]
        shap_list = [{"feature": features[j], "value": float(val[j])} for j in range(len(features))]

        # Individual bias detection (counterfactual + subgroup)
        from core.bias_detector import detect_bias_hybrid
        from core.bias_corrector import cafp_correct
        detection = detect_bias_hybrid(applicant_dict, model, df, threshold, cf_adjustments, cf_threshold)
        is_biased = detection["is_biased"]
        cf_score = detection["counterfactual"]["counterfactual_score"]
        cf_gap = detection["counterfactual"]["gap"]

        # Apply correction or raw decision
        adjusted_score = cafp_correct(prob, cf_score) if is_biased else prob
        final_decision = adjusted_score >= threshold
        applied_rule = "CAFP" if is_biased else "None"

        # Decision status
        if is_biased and final_decision:
            decision_status = "Auto-Corrected"
        elif is_biased and not final_decision:
            decision_status = "Needs Review"
        elif final_decision:
            decision_status = "Approved"
        else:
            decision_status = "Needs Review"

        # Correction detail
        correction_detail = None
        if is_biased:
            raw_decision = prob >= threshold
            correction_detail = {
                "beforeScore": prob,
                "beforeDecision": "Approved" if raw_decision else "Denied",
                "afterScore": adjusted_score,
                "afterDecision": "Approved" if final_decision else "Denied",
                "ruleApplied": applied_rule,
                "correctionApplied": True,
                "counterfactualScore": cf_score,
                "counterfactualGap": cf_gap,
                "method": "CAFP",
                "biasReasons": detection["reasons"]
            }

        results.append({
            "id": applicant_dict["Applicant_ID"],
            "name": get_deterministic_name(applicant_dict["Applicant_ID"]),
            "gender": applicant_dict["Gender"],
            "zipCode": str(applicant_dict["Zip_Code"]),
            "income": applicant_dict["Income"],
            "creditScore": applicant_dict["Credit_Score"],
            "age": applicant_dict["Age"],
            "dti": applicant_dict["Debt_to_Income"],
            "loanAmount": applicant_dict["Loan_Amount"],
            "employmentYears": applicant_dict["Employment_Years"],
            "biasStatus": "Biased" if is_biased else "Non-Biased",
            "decisionStatus": decision_status,
            "originalScore": prob,
            "adjustedScore": adjusted_score,
            "finalDecision": "Approved" if final_decision else "Denied",
            "shapValues": shap_list,
            "correctionDetail": correction_detail,
            "counterfactualScore": cf_score,
            "counterfactualGap": cf_gap,
            "explanation": "Explanation pending generation..."
        })
    return results


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    applicant_dict = {
        "Income": req.income, "Credit_Score": req.creditScore, "Age": req.age,
        "Debt_to_Income": req.dti, "Loan_Amount": req.loanAmount,
        "Employment_Years": req.employmentYears, "Gender": req.gender, "Zip_Code": req.zipCode
    }
    return run_inference(applicant_dict, req.governanceActive)

@app.get("/api/fairness")
def get_fairness():
    """Returns multi-dimensional hypothesis-tested fairness metrics."""
    if _cached_multidim:
        return _cached_multidim
    recompute_fairness_cache()
    return _cached_multidim or {"error": "Could not compute"}

@app.post("/api/explain")
def explain(req: ExplainRequest):
    ctx = {
        "applicant_id": req.applicant_id, "original_score": round(req.original_score, 2),
        "policy_rule": req.policy_rule, "final_decision": req.final_decision, "top_feature": req.top_feature
    }
    exp_json = generate_explanation(ctx)
    try:
        exp_dict = json.loads(exp_json)
        return {"explanation": exp_dict.get('explanation', exp_json)}
    except:
        return {"explanation": exp_json}

@app.post("/api/audit")
async def audit(req: AuditRequest):
    record = {
        "applicant_id": req.applicant_id, "original_score": req.original_score,
        "adjusted_score": req.adjusted_score, "final_decision": req.final_decision,
        "policy_applied": req.policy_applied, "timestamp": pd.Timestamp.now().isoformat()
    }
    await log_to_firestore(record)
    b64_pdf = generate_pdf_report(record)
    return {"success": True, "pdfBase64": b64_pdf}

@app.get("/api/policy")
def get_policy():
    return policy_state

@app.put("/api/policy")
def update_policy(req: PolicyUpdateRequest):
    if req.threshold is not None:
        policy_state["threshold"] = req.threshold
    if req.counterfactual_adjustments is not None:
        policy_state["counterfactual_adjustments"] = req.counterfactual_adjustments
    if req.counterfactual_threshold is not None:
        policy_state["counterfactual_threshold"] = req.counterfactual_threshold
    if req.decision_rules is not None:
        policy_state["decision_rules"] = req.decision_rules
    # Recompute fairness with new threshold
    try:
        recompute_fairness_cache()
    except:
        pass
    return {"success": True, "policy": policy_state}
