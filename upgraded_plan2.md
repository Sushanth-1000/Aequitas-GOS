# Aequitas-Gov: Upgraded Fairness Governance Layer (Free Tier)

## 1) Solution Overview
Aequitas-Gov is a cloud-deployed fairness governance layer for loan approval AI. It does not replace the bank’s model. It sits around the model and adds:
- pre-model data audit,
- post-model fairness audit,
- policy-based correction,
- drift detection,
- Gemini-powered explanation summaries,
- human approval for major changes,
- and full traceability in logs.

**Upgraded Features (100% Free Tier):**
- **Interactive "What-If" Simulator:** Real-time sliders in the UI to tweak applicant data and watch the model and policy react.
- **SHAP Feature Importance:** Enterprise-grade charts showing exactly which variables drove the decision.
- **Downloadable PDF Compliance Reports:** Automated export of the audit log and Gemini explanations using `ReportLab`.
- **Firebase Cloud Firestore (Free Tier):** A scalable, real-time NoSQL cloud database for the immutable audit trail. This prevents data loss when the Cloud Run container spins down, unlike a local file.
- **Gemini 2.5 Flash-Lite:** Using the generous free tier for high-speed explainability summaries.
- **Google Cloud Run (Free Tier):** Containerized deployment taking advantage of the 2 million requests/month free tier, providing a highly professional "Cloud Engine" architecture at zero cost.

## 2) Final Architecture
Applicant Data
   ↓
Pre-model Audit Layer
   ↓
Loan Scoring Model (Logistic Regression + SHAP)
   ↓
Post-model Fairness Audit
   ↓
Policy Engine (JSON rules)
   ↓
Gemini Explanation Layer (Gemini 2.5 Flash-Lite)
   ↓
Drift Monitor
   ↓
Human Review Gate (with What-If Simulator)
   ↓
MLOps Batch Retraining Feedback Loop (Triggered by high override volume)
   ↓
Final Loan Decision
   ↓
Traceability Log (Firebase Firestore)
   ↓
Cloud Dashboard (Deployed on Google Cloud Run)

### What each module does
- **Applicant Data**: Synthetic loan applications with income, credit score, DTI, loan amount, and a demographic group label.
- **Pre-model Audit Layer**: Checks distribution imbalance before scoring.
- **Loan Scoring Model**: A simple, explainable classifier (Logistic Regression) paired with SHAP for visual feature importance.
- **Post-model Fairness Audit**: Measures approval rate gaps and parity ratios.
- **Policy Engine**: Switches between “no fairness,” “demographic parity,” and “auto-on-drift with approval.” Evaluates scores against a core threshold of 0.65.
- **Gemini Explanation Layer**: Generates a plain-English summary of why a decision changed or why an alert was raised using the Gemini Free Tier API.
- **Drift Monitor**: Detects changes in batch distributions, fairness metrics, and tracks the volume of human overrides.
- **Human Review Gate**: Requires approve / reject / modify for major policy changes, and includes an interactive What-If Simulator.
- **MLOps Batch Retraining Feedback Loop**: Collects human overrides in Firebase. Once override volume hits a critical threshold, it alerts data scientists to export the human-validated data and retrain the Scikit-learn model, ensuring continuous learning without deployment instability.
- **Traceability Log**: Stores decisions, policies, and actions in Firebase Firestore. Allows exporting to a PDF Compliance Report.
- **Cloud Dashboard**: The Streamlit MVP surface, dockerized and deployed on Google Cloud Run.

## 3) Deliverables

### A. Working MVP (Google Cloud Run)
A dockerized Streamlit app deployed on Google Cloud Run's free tier featuring: applicant list, raw/adjusted decisions, fairness metrics, drift alerts, policy switcher, human approval panel, What-If simulator, and PDF report exporter.

### B. Loan Scoring Engine & Data
Synthetic dataset generator, Scikit-learn Logistic Regression baseline model, SHAP explainer integration.

### C. Fairness Layer
Approval rate by group, disparity ratio calculation, threshold adjustment logic.

### D. Policy Engine
JSON policy file and human approval workflow.

### E. Gemini Explanation Module
Integration with Gemini 2.5 Flash-Lite for "why this changed" summaries and reviewer-friendly explanations.

### F. Audit Log & Reporting
Firebase Firestore database history and a `ReportLab` module for generating downloadable PDF compliance reports.
