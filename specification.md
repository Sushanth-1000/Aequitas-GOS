# Aequitas-Gov: Upgraded Fairness Governance Layer (Free Tier)

## 1) Solution Overview

*   **What-If Simulator**: 
    *   **Behavior**: Provides real-time recalculation of loan approval probability and fairness metrics when user attributes are manually altered.
    *   **Inputs**: Feature dictionary (e.g., `{"Income": 55000, "Credit_Score": 680, "Age": 35, "Gender": "Female", "Loan_Amount": 20000}`). 
    *   **Outputs**: Recalculated `approval_probability` (float 0.0-1.0), `approval_decision` (boolean), `disparate_impact_ratio` (float).
    *   **Internal Logic**: Modifies the inference payload in memory, re-runs the Logistic Regression `predict_proba` method synchronously, and updates the UI state without committing to Firestore until the Human Reviewer explicitly confirms the override. Features 5 fixed sliders (Income, Credit Score, Age, Loan Amount, Debt-to-Income). Range values are set to 0.5x to 2.0x of the base feature values.
*   **SHAP**: 
    *   **Behavior**: Calculates the local feature contributions to the final model prediction to provide interpretability.
    *   **Type**: `shap.LinearExplainer` (optimized for Logistic Regression).
    *   **Background Dataset**: K-Means clustered summary of the training dataset (k=50) to reduce computation time.
    *   **Visualization**: Outputs a SHAP waterfall plot and a SHAP force plot rendered in Streamlit using `st_shap`.
    *   **Inputs**: Single applicant transformed feature vector (1x5 array). Computed after preprocessing on the pipeline-transformed feature matrix.
    *   **Outputs**: SHAP base value (float), SHAP values array (1x5 float array).
*   **PDF Reports**: 
    *   **Behavior**: Generates an immutable snapshot of the applicant's evaluation, fairness audit, and Gemini explanation.
    *   **Generation Trigger**: User clicks "Export PDF Audit Trail" button in the UI, invoking a synchronous ReportLab generation function.
    *   **Structure**: 4 sections: 1. Applicant Profile (table), 2. Model Decision & SHAP Breakdown (chart & text), 3. Fairness Audit Results (metrics table), 4. Policy Engine Action & Gemini Rationale (text block).
    *   **Inputs**: Complete session state dictionary for the specific applicant.
    *   **Outputs**: Base64 encoded PDF file served as a download link.
*   **Firestore**: 
    *   **Behavior**: Serves as the Traceability Log. Enforced as an append-only audit log via application logic and security rules.
    *   **Collection Structure**: Collection: `loan_audits`. Documents: Firestore auto-ID. The `applicant_id` is stored as a field inside the document.
    *   **Write Triggers**: Asynchronously triggered via `asyncio` exactly once after the *Final Loan Decision* module completes its execution, ensuring the system stays comfortably within the free tier quota (20,000 writes/day, 50,000 reads/day, 1 GiB storage).
    *   **Inputs**: JSON payload containing `timestamp`, `applicant_id`, `original_decision`, `fairness_metrics`, `policy_action`, `final_decision`, `reviewer_id`.
    *   **Outputs**: Firestore write confirmation (HTTP 200) or error exception.
*   **Gemini**: 
    *   **Behavior**: Translates complex SHAP values, fairness metrics, and policy actions into a natural language summary for human reviewers.
    *   **Request/Response Format**: REST API call to Gemini 2.5 Flash-Lite endpoint via `google-genai` SDK. Inputs are formatted via a strict string template. Expected output is a JSON-formatted string constrained by `response_mime_type="application/json"`. To strictly respect the free tier, the system makes exactly one explanation call per reviewed applicant.
    *   **Prompt Template**: "You are a risk compliance officer. Analyze this loan decision: Original Model Score: {score}, Fairness Policy Triggered: {policy}, Final Decision: {decision}. Provide a 3-sentence explanation of why the final decision was reached, avoiding technical jargon. Return strictly as JSON: {'explanation': '<text>'}."
*   **Cloud Run**: 
    *   **Behavior**: Hosts the Streamlit application and backend logic in a stateless container.
    *   **Request Flow**: HTTPS GET/POST requests routed through Google Cloud Load Balancing to the Cloud Run container instance on port 8080.
    *   **Lifecycle**: Container scales from 0 to 1 instance on the first request. Idle timeout is configured to 15 minutes. State is strictly maintained in the client session (Streamlit `st.session_state`) or written to Firestore. Optimized to stay within the free tier limits (240,000 vCPU-seconds and 450,000 GiB-seconds per month in us-central1).

## 2) Final Architecture

**Pipeline & Data Flow**:
1. Applicant Data (JSON) -> Pre-model Audit Layer (Synchronous validation).
2. Validated Data -> Loan Scoring Model (Synchronous inference) -> Outputs Probability (float).
3. Probability & Validated Data -> Post-model Fairness Audit (Synchronous calculation) -> Outputs Fairness Metrics (JSON).
4. Fairness Metrics & Probability -> Policy Engine (Synchronous evaluation) -> Outputs Adjusted Decision (boolean).
5. Adjusted Decision & Applicant Data -> Gemini Explanation Layer (Synchronous REST call, 5s timeout) -> Outputs Rationale (text).
6. Execution context passed to Drift Monitor (Asynchronous batch tracking in memory) and Traceability Log (Asynchronous Firestore write).
7. If Human Review required -> Human Review Gate (Synchronous UI block) -> Final Decision.
8. Manual Trigger -> MLOps Batch Retraining Feedback Loop (simulated for MVP).

**State Storage**: In-flight applicant evaluation stored in memory (`st.session_state`). Final audit trails persisted in Firestore.

### What each module does

*   **Applicant Data**
    *   **Signature**: `def load_applicant(data: dict) -> dict`
    *   **Internal Logic**: Parses incoming JSON, validates against expected schema (10 specific keys), type-casts strings to integers/floats.
    *   **Edge Cases**: Missing data triggers imputation (medians for numerical, mode for categorical). 
    *   **Failure Handling**: Throws `ValueError` if strictly required fields (e.g., `Applicant_ID`) are absent.
    *   **Latency Expectations**: < 10ms.
*   **Pre-model Audit Layer**
    *   **Signature**: `def validate_features_for_inference(applicant_data: dict, dataset_reference: pd.DataFrame) -> dict`
    *   **Internal Logic**: Inspects dataset distribution and imbalance. Validates that protected attributes (`Age`, `Gender`, `Zip_Code`) are explicitly excluded from the model training features and inference payload. Retains protected attributes only for post-model auditing and fairness correction, not for scoring.
    *   **Edge Cases**: Extreme bias scenarios or heavily out-of-distribution inputs are logged as anomalous.
    *   **Failure Handling**: If protected attributes are found in the model payload whitelist, throws a `FeatureLeakageError` and halts the pipeline.
    *   **Latency Expectations**: < 5ms.
*   **Loan Scoring Model (Logistic Regression + SHAP)**
    *   **Signature**: `def score_loan(features: dict) -> tuple[float, list[float]]`
    *   **Internal Logic**: Applies standard scalar transform, runs `predict_proba()` to get base approval chance. Passes the transformed vector to `shap.LinearExplainer` to extract SHAP values. The model uses an explicit feature whitelist: `['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']`. Protected attributes are excluded. SHAP is computed after preprocessing on the pipeline-transformed feature matrix.
    *   **Edge Cases**: Model failure (e.g., matrix dimension mismatch) triggers a graceful fallback to a default safe-deny decision.
    *   **Failure Handling**: Try-except block catches `sklearn` errors, logs to stderr, returns `(0.0, [0.0]*5)`.
    *   **Latency Expectations**: < 100ms.
*   **Post-model Fairness Audit**
    *   **Signature**: `def calculate_fairness(predictions: list, protected_classes: list) -> dict`
    *   **Internal Logic**: Computes Demographic Parity Difference (DPD) and Disparate Impact Ratio (DIR). DIR = (Approval Rate Protected) / (Approval Rate Unprotected).
    *   **Edge Cases**: Division by zero if unprotected approval rate is 0; returns DIR = 1.0.
    *   **Failure Handling**: Returns baseline `{"DIR": 1.0, "DPD": 0.0}` on calculation error.
    *   **Latency Expectations**: < 20ms.
*   **Policy Engine (JSON rules)**
    *   **Signature**: `def enforce_policy(score: float, dir_metric: float, rules: dict) -> tuple[bool, str]`
    *   **Internal Logic**: Parses rules. If `dir_metric < 0.8` (Rule 1) and applicant is protected, applies an affirmative action boost of `+0.1` to the score. Evaluates final score against `threshold = 0.65`.
    *   **Edge Cases**: Conflicting rules are resolved via a priority index defined in the JSON.
    *   **Failure Handling**: If JSON parsing fails, engine defaults to strict model score threshold without adjustments.
    *   **Latency Expectations**: < 5ms.
*   **Gemini Explanation Layer (Gemini 2.5 Flash-Lite)**
    *   **Signature**: `def generate_explanation(context: dict) -> str`
    *   **Internal Logic**: Constructs the prompt string from the `context` dictionary. Calls the Gemini API with temperature `0.2` and max output tokens `150`. Optimized for the free tier by generating exactly one explanation call per reviewed applicant.
    *   **Edge Cases**: Gemini API failure (rate limit, 503) triggers a static fallback explanation: "System adjustment applied based on fairness compliance thresholds."
    *   **Failure Handling**: Try-except with a hard 5.0-second timeout.
    *   **Latency Expectations**: 1500ms - 3500ms.
*   **Drift Monitor**
    *   **Signature**: `def track_drift(features: dict, batch_history: list) -> bool`
    *   **Internal Logic**: Maintains a rolling window of the last 1000 applicants in memory. Calculates Population Stability Index (PSI) for the `Income` and `Credit_Score` features. Trigger condition: PSI > 0.2.
    *   **Edge Cases**: Insufficient batch size (< 100 records) bypasses PSI calculation.
    *   **Failure Handling**: Non-blocking; returns `False` if statistics fail.
    *   **Latency Expectations**: < 50ms.
*   **Human Review Gate (with What-If Simulator)**
    *   **Signature**: `def human_review_ui(applicant_state: dict) -> dict`
    *   **Internal Logic**: Renders Streamlit UI. Pauses pipeline execution until the reviewer clicks "Approve Override" or "Reject Override". If timeout (e.g., session expires), defaults to the system recommendation. Tracks override logic and reviewer decision.
    *   **Edge Cases**: Reviewer submits without providing mandatory justification text; UI blocks submission.
    *   **Failure Handling**: Streamlit session state reset gracefully recovers to the pending review list.
    *   **Latency Expectations**: Synchronous with human interaction (minutes).
*   **MLOps Batch Retraining Feedback Loop**
    *   **Signature**: `def trigger_retraining(override_count: int) -> None`
    *   **Internal Logic**: Provides a manual retraining recommendation. In the prototype, clicking "Trigger Retraining" simulates a batch retraining alert without actual model recompilation, safely displaying continuous learning capabilities.
    *   **Edge Cases**: Prevents redundant triggers by locking the retraining button for 24 hours after it is pressed.
    *   **Failure Handling**: Displays a warning if the simulation trigger fails.
    *   **Latency Expectations**: < 100ms (synchronous simulated response).
*   **Final Loan Decision**
    *   **Signature**: `def finalize_decision(state: dict) -> dict`
    *   **Internal Logic**: Compiles the final boolean approval status, the exact applied policy, and the reviewer notes into a finalized immutable dictionary.
    *   **Edge Cases**: State mismatches reject the finalization and require re-evaluation.
    *   **Failure Handling**: Returns an error dict if compilation fails.
    *   **Latency Expectations**: < 5ms.
*   **Traceability Log (Firebase Firestore)**
    *   **Signature**: `async def log_to_firestore(record: dict) -> str`
    *   **Internal Logic**: Initializes Firestore async client, selects `loan_audits` collection, uses `add()` to write the document exactly once per finalized decision to respect free tier limits.
    *   **Edge Cases**: Network disconnect retries up to 3 times with exponential backoff.
    *   **Failure Handling**: Writes to local `fallback_log.json` if Firestore is entirely unreachable.
    *   **Latency Expectations**: < 300ms.
*   **Cloud Dashboard (Deployed on Google Cloud Run)**
    *   **Signature**: `def main_ui() -> None`
    *   **Internal Logic**: Streamlit application entry point. Handles routing, authentication, and layout rendering. 
    *   **Edge Cases**: Browser incompatibility handled by Streamlit core logic.
    *   **Failure Handling**: Global exception handler displays a user-friendly error state instead of stack traces.
    *   **Latency Expectations**: Page load < 2 seconds.

## 3) Deliverables

### A. Working MVP (Google Cloud Run)
*   **Number of UI tabs**: 3
*   **Names of tabs**: 1. Applicant Queue, 2. Audit & Override, 3. System Metrics
*   **Layout of each tab**:
    *   **Top Section**: High-level KPI metrics (Total Applicants, Fairness Status, Active Alerts).
    *   **Middle Section**: Primary interactive components (Data tables on Tab 1, What-If sliders & SHAP on Tab 2, Drift charts on Tab 3).
    *   **Bottom Section**: Logs and export controls (PDF download, Firestore sync status).
*   **Components per tab**:
    *   Tab 1: 1 Dataframe (Applicants), 3 Metric Cards.
    *   Tab 2: 5 Sliders (What-If), 1 Text Area (Gemini), 2 SHAP Charts, 2 Action Buttons.
    *   Tab 3: 2 Drift Line Charts, 1 Policy JSON Editor, 1 Retraining Alert Box.
*   **Number of charts per tab**: Tab 1 (0 charts), Tab 2 (2 SHAP charts), Tab 3 (2 Drift charts). Total 4 charts in MVP.
*   **Type of charts**: Horizontal Bar Chart (SHAP summary), Waterfall Chart (SHAP local), Line Chart (PSI Drift over time).
*   **Number of insights displayed**: Exactly 4 key insights per applicant (Original Score, Policy Action, Adjusted Score, Final Decision).
*   **Color coding system**: 
    *   Alerts/Drift: Red (#FF4B4B)
    *   Fairness Triggered/Caution: Yellow (#FACA2B)
    *   Approval/Compliance: Green (#00C853)
*   **User interaction flow**: User selects applicant from Queue -> Reviews SHAP and metrics on Audit tab -> Adjusts What-If sliders if necessary -> Reads Gemini explanation -> Clicks "Approve" or "Reject" -> Generates PDF.

### B. Loan Scoring Engine & Data
*   **Dataset schema**:
    1.  `Applicant_ID` (String, UUID)
    2.  `Income` (Float, 20000.0 - 250000.0)
    3.  `Credit_Score` (Integer, 300 - 850)
    4.  `Age` (Integer, 18 - 80)
    5.  `Employment_Years` (Float, 0.0 - 40.0)
    6.  `Debt_to_Income` (Float, 0.0 - 1.0)
    7.  `Gender` (String, "Male", "Female", "Other")
    8.  `Zip_Code` (String, 5-digit)
    9.  `Loan_Amount` (Float, 1000.0 - 100000.0)
    10. `Default_History` (Integer, 0 or 1)
*   **Example rows**:
    *   Row 1: `{"Applicant_ID": "A001", "Income": 45000.0, "Credit_Score": 620, "Age": 28, "Employment_Years": 3.0, "Debt_to_Income": 0.45, "Gender": "Female", "Zip_Code": "10001", "Loan_Amount": 15000.0, "Default_History": 0}`
    *   Row 2: `{"Applicant_ID": "A002", "Income": 120000.0, "Credit_Score": 750, "Age": 45, "Employment_Years": 15.0, "Debt_to_Income": 0.20, "Gender": "Male", "Zip_Code": "90210", "Loan_Amount": 50000.0, "Default_History": 0}`
    *   Row 3: `{"Applicant_ID": "A003", "Income": 35000.0, "Credit_Score": 580, "Age": 65, "Employment_Years": 0.0, "Debt_to_Income": 0.60, "Gender": "Other", "Zip_Code": "60601", "Loan_Amount": 5000.0, "Default_History": 1}`
*   **Feature selection logic**: Pearson correlation matrix threshold > 0.1 against the target variable (Default_History). Dropping highly collinear features (> 0.8).
*   **Bias injection method**: Mathematically subtract 50 points from the `Credit_Score` and multiply `Income` by 0.85 for all rows where `Gender == "Female"` during the synthetic data generation script to simulate historical systemic bias.
*   **Model training pipeline**: Scikit-Learn `Pipeline`. Steps: 1. `SimpleImputer` (median), 2. `StandardScaler`, 3. `LogisticRegression(class_weight='balanced', max_iter=500)`. Feature whitelist for training: `['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']`. Target: `Default_History`. Protected/Audit-only attributes explicitly excluded: `['Age', 'Gender', 'Zip_Code']`.
*   **Decision threshold formula**: `Approval = True if predict_proba(X)[1] >= 0.65 else False`

### C. Fairness Layer
*   **Exact metrics (formulas)**:
    *   Disparate Impact Ratio (DIR) = (P(Y=1 | Z=Protected)) / (P(Y=1 | Z=Unprotected))
    *   Demographic Parity Difference (DPD) = P(Y=1 | Z=Unprotected) - P(Y=1 | Z=Protected)
*   **Number of metrics**: 2
*   **Threshold values**: 
    *   DIR Threshold: Minimum 0.80 (80% rule).
    *   DPD Threshold: Maximum 0.10.
*   **Adjustment algorithm**: 
    1. Check if applicant is protected.
    2. Check if global DIR < 0.80.
    3. If yes to both, apply scalar modifier: `adjusted_score = min(1.0, original_score * 1.15)`.
    4. Re-evaluate `adjusted_score >= 0.65`.
*   **Before vs after computation logic**: Calculate metrics on raw model outputs (Before). Store state. Apply Adjustment algorithm. Recalculate metrics on adjusted outcomes (After) to prove the policy effectively restored DIR to >= 0.80.

### D. Policy Engine
*   **Full JSON schema**:
    ```json
    {
      "engine_version": "1.0",
      "active_mode": "enforcement",
      "decision_rules": [
        {
          "rule_id": "R001",
          "priority": 1,
          "condition": {
            "metric": "DIR",
            "operator": "<",
            "value": 0.8,
            "target_group": "Gender=Female"
          },
          "action": {
            "type": "score_multiplier",
            "value": 1.15
          }
        },
        {
          "rule_id": "R002",
          "priority": 2,
          "condition": {
            "metric": "model_score",
            "operator": "<",
            "value": 0.40
          },
          "action": {
            "type": "hard_reject",
            "value": true
          }
        }
      ]
    }
    ```
*   **Supported modes**: `enforcement` (automatically applies adjustments), `shadow` (logs adjustments but does not alter final output).
*   **Decision rules**: Array of rules defining conditions based on `metric`, `operator`, and `value`, mapped to an `action`.
*   **Conflict resolution logic**: Lowest `priority` integer evaluates first. A `hard_reject` action strictly overrides a `score_multiplier` action regardless of priority.
*   **Trigger vs recommendation logic**: If `active_mode` is `enforcement`, the engine alters the application score directly. If `active_mode` is `shadow`, it generates a `recommendation` flag appended to the UI for human review.

### E. Gemini Explanation Module
*   **Exact prompt template**: 
    `You are a risk compliance officer. Analyze this loan decision for Applicant {applicant_id}: Original Model Score: {original_score}, Policy Rule Triggered: {policy_rule}, Final Decision: {final_decision}, Key Factor (SHAP max): {top_feature}. Provide exactly a 3-sentence explanation of why the final decision was reached, avoiding technical ML jargon. Do not hallucinate data. Return strictly as JSON.`
*   **Input variables passed**: `applicant_id` (string), `original_score` (float), `policy_rule` (string), `final_decision` (boolean), `top_feature` (string).
*   **Output JSON structure expected**:
    ```json
    {
      "explanation": "The loan application was initially borderline due to a high debt-to-income ratio. However, an automated fairness compliance policy was applied to ensure equal opportunity standards were met. Consequently, the final decision resulted in an approval."
    }
    ```
*   **Token optimization strategy**: Strict `max_output_tokens=150` parameter passed to the SDK. Inputs are truncated to essential variables only, omitting the full applicant vector to save context window space. Optimized for the free tier by ensuring exactly one generation per reviewed applicant.
*   **Error handling fallback**: Hard timeout at 5000ms. If failed, returns `{"explanation": "Automated explanation generation timed out. The decision was processed via standard policy enforcement."}`

### F. Audit Log & Reporting
*   **Firestore collection schema**: Root Collection `loan_audits` -> Document (Firestore auto-ID). No subcollections.
*   **Document structure**:
    *   `timestamp`: ISO-8601 string.
    *   `applicant_id`: String UUID.
    *   `original_score`: Float.
    *   `final_decision`: Boolean.
    *   `policy_applied`: String (Rule ID or "None").
    *   `reviewer_id`: String (Email or "Automated").
    *   `gemini_explanation`: String.
    *   `dir_metric_snapshot`: Float.
*   **Write triggers**: Fires exactly once immediately upon the `human_review_ui` submission or `finalize_decision` automated completion to minimize write operations and respect the free quota.
*   **Query patterns**: Indexed queries on `timestamp` (descending, for dashboard history) and `policy_applied` (for auditing policy impact).
*   **PDF report structure**:
    1. Header: Date, Applicant ID, Final Status.
    2. Applicant Profile Table: 10 features, 2 columns.
    3. Model Analysis: Base Score, Top 3 SHAP feature impacts (+/- values).
    4. Compliance Audit: DIR value, DPD value, Active Policy JSON snapshot.
    5. Rationale: Gemini Text Output, Reviewer Manual Notes.
    Formatting: Times New Roman, 12pt, strict page breaks between sections.
*   **Export workflow**: User clicks UI export button -> Streamlit passes session state to ReportLab -> ReportLab generates PDF directly -> PDF loaded into `st.download_button` memory buffer.
