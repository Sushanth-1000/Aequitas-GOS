"""
Bias Detector — Counterfactual Fairness + Subgroup Detection
Individual-level bias detection using counterfactual analysis.
"""
import numpy as np
import pandas as pd


# Default counterfactual adjustments (configurable via policy JSON)
DEFAULT_CF_ADJUSTMENTS = {
    "Female": {"Income": {"op": "divide", "value": 0.85}, "Credit_Score": {"op": "add", "value": 50}},
    "Non-Binary": {"Income": {"op": "divide", "value": 0.90}, "Credit_Score": {"op": "add", "value": 30}},
    "Male": {}  # Reference group, no adjustment
}


def build_counterfactual(applicant: dict, cf_adjustments: dict) -> dict:
    """
    Create a counterfactual version of the applicant by reversing known bias.
    For a Female applicant, this simulates: "What if historical discrimination
    hadn't depressed her income and credit score?"
    """
    gender = applicant.get("Gender", "Male")
    adjustments = cf_adjustments.get(gender, {})

    cf = dict(applicant)
    for feature, adj in adjustments.items():
        original_val = cf.get(feature, 0)
        if adj["op"] == "divide":
            cf[feature] = original_val / adj["value"]
        elif adj["op"] == "multiply":
            cf[feature] = original_val * adj["value"]
        elif adj["op"] == "add":
            cf[feature] = original_val + adj["value"]
        elif adj["op"] == "subtract":
            cf[feature] = original_val - adj["value"]

    # Clip to valid ranges
    cf["Credit_Score"] = min(850, max(300, cf.get("Credit_Score", 0)))
    cf["Income"] = max(0, cf.get("Income", 0))
    return cf


def compute_counterfactual_gap(applicant: dict, model, cf_adjustments: dict) -> dict:
    """
    Compute the counterfactual fairness gap for a single applicant.
    Returns the original score, counterfactual score, and gap.
    """
    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']

    # Original prediction
    x_orig = pd.DataFrame([{f: applicant[f] for f in model_features}])
    score_orig = float(model.predict_proba(x_orig)[0][0])

    # Counterfactual prediction
    cf_applicant = build_counterfactual(applicant, cf_adjustments)
    x_cf = pd.DataFrame([{f: cf_applicant[f] for f in model_features}])
    score_cf = float(model.predict_proba(x_cf)[0][0])

    gap = abs(score_orig - score_cf)

    return {
        "original_score": score_orig,
        "counterfactual_score": score_cf,
        "gap": round(gap, 4),
        "counterfactual_features": {
            f: round(cf_applicant[f], 2) for f in model_features
            if cf_applicant[f] != applicant.get(f)
        }
    }


def detect_subgroup_bias(applicant: dict, df: pd.DataFrame, model, threshold: float) -> dict:
    """
    Simplified FairTree: check if the applicant's subgroup
    (Gender × Income bracket) has a significantly different approval rate.
    """
    gender = applicant.get("Gender", "Male")
    income = applicant.get("Income", 0)
    income_bracket = "low" if income < 50000 else "mid" if income < 80000 else "high"

    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']

    # Score all applicants in same subgroup
    mask = df["Gender"] == gender
    if income_bracket == "low":
        mask &= df["Income"] < 50000
    elif income_bracket == "mid":
        mask &= (df["Income"] >= 50000) & (df["Income"] < 80000)
    else:
        mask &= df["Income"] >= 80000

    subgroup = df[mask]
    if len(subgroup) < 5:
        return {"subgroup_biased": False, "subgroup_size": len(subgroup), "reason": "Insufficient data"}

    X_sub = subgroup[model_features]
    scores = model.predict_proba(X_sub)[:, 0]
    sub_rate = float(np.mean(scores >= threshold))

    # Compare to overall rate
    X_all = df[model_features]
    all_scores = model.predict_proba(X_all)[:, 0]
    overall_rate = float(np.mean(all_scores >= threshold))

    deviation = abs(sub_rate - overall_rate)
    is_biased = deviation > 0.15

    return {
        "subgroup_biased": is_biased,
        "subgroup_label": f"{gender} / {income_bracket} income",
        "subgroup_size": len(subgroup),
        "subgroup_rate": round(sub_rate, 4),
        "overall_rate": round(overall_rate, 4),
        "deviation": round(deviation, 4)
    }


def detect_bias_hybrid(applicant: dict, model, df: pd.DataFrame,
                       threshold: float, cf_adjustments: dict,
                       cf_threshold: float = 0.05) -> dict:
    """
    Combined bias detection: counterfactual gap OR subgroup bias.
    """
    cf_result = compute_counterfactual_gap(applicant, model, cf_adjustments)
    sub_result = detect_subgroup_bias(applicant, df, model, threshold)

    cf_biased = cf_result["gap"] > cf_threshold
    sub_biased = sub_result["subgroup_biased"]

    is_biased = cf_biased or sub_biased

    reasons = []
    if cf_biased:
        reasons.append(f"Counterfactual gap: {cf_result['gap']:.3f}")
    if sub_biased:
        reasons.append(f"Subgroup deviation: {sub_result['deviation']:.3f}")

    return {
        "is_biased": is_biased,
        "reasons": reasons,
        "counterfactual": cf_result,
        "subgroup": sub_result
    }
