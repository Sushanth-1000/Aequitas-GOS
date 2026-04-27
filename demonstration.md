# Aequitas-Gov: 3-Minute Demo Script

## DEMO OBJECTIVE
To demonstrate Aequitas-Gov's end-to-end fairness governance by showcasing real-time bias detection, automated policy correction, SHAP explainability, continuous drift monitoring with simulated MLOps retraining, and immutable human-in-the-loop audit logging.

---

## 1. DEMO SETUP (MANDATORY)

### Fixed Applicant Record (MUST MATCH DATASET FORMAT)
You MUST use ONE exact applicant:
```json
{
  "Applicant_ID": "A001",
  "Income": 45000.0,
  "Credit_Score": 620,
  "Age": 28,
  "Employment_Years": 3.0,
  "Debt_to_Income": 0.45,
  "Gender": "Female",
  "Zip_Code": "10001",
  "Loan_Amount": 15000.0,
  "Default_History": 0
}
```

### Fixed Metrics Table (MANDATORY)
| Metric | Value |
| --- | --- |
| Original Score | 0.62 |
| Adjusted Score | 0.71 |
| DIR Before | 0.72 |
| DIR After | 0.84 |
| DPD Before | 0.18 |
| DPD After | 0.08 |

### Drift Simulation Table (MANDATORY)
| Batch | PSI | DIR | Status |
| --- | --- | --- | --- |
| Batch 1 | 0.05 | 0.85 | Stable |
| Batch 2 | 0.12 | 0.78 | Warning |
| Batch 3 | 0.25 | 0.72 | Alert |

### Initial System State
* **Policy mode**: enforcement
* **Threshold**: 0.65
* **Active Batch**: Batch 1 (Stable)
* **Firestore**: empty

---

## 2. DEMO FLOW (TIMED SEQUENCE: 180 SECONDS)

⚠️ **STRICT FLOW**: Baseline & Whitelist → SHAP Interpretability → Bias Exposure → Drift Monitoring & MLOps → Policy Activation → What-If → Human Decision → Gemini & Audit Logging

### Step 1 (0–15 sec): System Intro & Pre-Model Audit
*   **Active Tab**: Applicant Queue
*   **Narration**: "Welcome to Aequitas-Gov. Our system ingests loan applications and runs a pre-model audit, strictly isolating protected attributes like Gender and Age from the model to prevent direct feature leakage."

### Step 2 (15–35 sec): Baseline Decision & SHAP
*   **Active Tab**: Applicant Queue → Audit & Override
*   **Action**: Click Applicant A001. Scroll to SHAP charts.
*   **Output**: 
    *   Score: 0.62 
    *   Decision: Rejected (RED)
*   **Narration**: "For Applicant A001, the initial score is 0.62, falling short of our 0.65 threshold. Looking at our SHAP explainer, we can transparently see that the high Debt-to-Income ratio of 0.45 was the primary detractor."

### Step 3 (35–55 sec): Bias Exposure
*   **Active Tab**: System Metrics
*   **Show**: 
    *   DIR = 0.72 (RED)
    *   DPD = 0.18 (RED)
*   **Narration**: "However, zooming out to our global metrics, we detect a systemic issue. Our Disparate Impact Ratio has fallen to 0.72—a severe violation of the 80% compliance rule for female applicants."

### Step 4 (55–85 sec): Continuous Monitoring & MLOps Trigger
*   **Active Tab**: System Metrics
*   **Action**: Switch Batch: Batch 1 → Batch 2 → Batch 3. Click "Trigger Retraining".
*   **System updates**: 
    *   PSI progression: 0.05 → 0.12 → 0.25
    *   DIR drops: 0.85 → 0.78 → 0.72
    *   Red alert banner appears.
*   **Narration**: "This isn't a static snapshot. Our continuous drift monitor calculates Population Stability Index on a rolling 1,000-applicant window. As we simulate time progression, PSI spikes to 0.25. The system alerts us to data drift, and I can manually trigger our simulated MLOps batch retraining loop right from the dashboard."

### Step 5 (85–105 sec): Policy Activation
*   **Active Tab**: Audit & Override
*   **Action**: Toggle policy ON
*   **Output**: 
    *   Score → 0.71
    *   Decision → Approved (GREEN)
    *   Global DIR → 0.84 (GREEN)
*   **Narration**: "To mitigate immediate harm while the model retrains, our Policy Engine steps in. Because the global DIR was below 0.8, the engine applies an automated compliance multiplier. The score adjusts to 0.71, restoring our global DIR to a healthy 0.84."

### Step 6 (105–135 sec): What-If + Human Review
*   **Active Tab**: Audit & Override
*   **Action**: 
    *   Sliders: Income → 50000, Credit Score → 640. 
    *   Click "Approve Override".
*   **Output**: Score → 0.75
*   **Narration**: "As a human reviewer, I can use the What-If simulator to test edge cases. Boosting income to 50k safely raises the score to 0.75. Satisfied with the compliance check, I lock in the final approval."

### Step 7 (135–165 sec): Gemini Explanation + Audit Log
*   **Active Tab**: Audit & Override
*   **Action**: Highlight Gemini text area. Click "Export PDF Audit Trail".
*   **Show**: 
    *   Gemini explanation JSON/text
    *   Firestore success toast message
*   **Narration**: "Upon approval, Gemini 2.5 Flash-Lite generates a jargon-free, three-sentence compliance rationale. Simultaneously, this entire event is written to Firestore as an append-only traceability log, and we generate an immutable PDF report containing the SHAP data and policy snapshot for external regulators."

### Step 8 (165–180 sec): Closing
*   **Active Tab**: System Metrics
*   **Narration**: "With Aequitas-Gov, financial institutions achieve AI scale without sacrificing continuous monitoring, interpretability, or strict compliance. Thank you."

---

## 3. EXACT NUMBERS TO USE
* Score: 0.62 → 0.71 → 0.75
* Threshold: 0.65
* DIR: 0.72 → 0.84
* DPD: 0.18 → 0.08
* PSI: 0.05 → 0.12 → 0.25

---

## 4. VISUAL ELEMENTS
* **Red (#FF4B4B)**: bias/drift alert, initial rejection
* **Yellow (#FACA2B)**: fairness triggered/warning
* **Green (#00C853)**: approved override, healthy DIR

---

## 5. FAILURE BACKUP PLAN

### Gemini Failure
"Gemini rate limit hit on the free tier, so the audit summary defaults to our static fallback explanation: 'System adjustment applied based on fairness compliance thresholds.'"

### Drift Not Triggered
"If live tracking stalls, I can switch to our preloaded drift scenario to demonstrate the exact PSI failure state."

### Firestore Failure
"Network error on Firestore, but the system safely catches this by writing to our local fallback JSON log."
