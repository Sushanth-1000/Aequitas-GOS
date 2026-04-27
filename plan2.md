# Aequitas-Gov: Fairness Governance Layer

## 2) Solution Overview
Aequitas-Gov is a cloud-deployed fairness governance layer for loan approval AI. It does not replace the bank’s model. It sits around the model and adds:
- pre-model data audit,
- post-model fairness audit,
- policy-based correction,
- drift detection,
- Gemini-powered explanation summaries,
- human approval for major changes,
- and full traceability in logs.

The core idea is simple: loan score first, fairness audit second, policy correction third, human review fourth, audit trail always. For the hackathon, this is strong because it is specific, socially relevant, and easy to demonstrate live. Gemini API is a natural fit for the explanation layer, Cloud Run is a clean way to deploy the app, and Vertex AI is a good optional extension if you want stronger ML/MLOps positioning.

## 3) Final Architecture
Applicant Data
   ↓
Pre-model Audit Layer
   ↓
Loan Scoring Model
   ↓
Post-model Fairness Audit
   ↓
Policy Engine (JSON rules)
   ↓
Gemini Explanation Layer
   ↓
Drift Monitor
   ↓
Human Review Gate
   ↓
Feedback / Policy Update
   ↓
Final Loan Decision
   ↓
Traceability Log
   ↓
Cloud Dashboard

### What each module does
- **Applicant Data**: Synthetic loan applications with income, credit score, employment length, debt-to-income ratio, loan amount, purpose, and a group label used only for auditing.
- **Pre-model Audit Layer**: Checks distribution imbalance before scoring.
- **Loan Scoring Model**: A simple, explainable classifier such as logistic regression or random forest.
- **Post-model Fairness Audit**: Measures approval rate gaps, parity ratio, and equal-opportunity style gaps.
- **Policy Engine**: Switches between “no fairness,” “demographic parity,” and “auto-on-drift with approval.”
- **Gemini Explanation Layer**: Generates a plain-English summary of why a decision changed or why an alert was raised. Gemini API supports API-based interaction and structured outputs, which fits well for explanation text and audit summaries.
- **Drift Monitor**: Detects changes in batch distributions and fairness metrics.
- **Human Review Gate**: Requires approve / reject / modify for major policy changes.
- **Traceability Log**: Stores model score, original decision, final decision, policy used, fairness summary, drift flag, and reviewer action.
- **Cloud Dashboard**: The Streamlit MVP surface for judges and users.

## 4) Deliverables
### A. Working MVP
A cloud-deployed Streamlit app with: applicant list, raw loan decisions, fairness-adjusted decisions, fairness metrics, drift alerts, policy switcher, human approval panel, decision history, Gemini explanation panel. Cloud Run is a good deployment target because it is a fully managed platform for running containerized web apps and services.

### B. Loan Scoring Engine
synthetic dataset, baseline model, decision threshold, score output, approval / reject result.

### C. Fairness Layer
approval rate by group, disparity ratio, before-vs-after comparison, threshold adjustment.

### D. Policy Engine
JSON policy file, policy modes, drift-triggered recommendation, human approval workflow.

### E. Monitoring + Drift Detection
batch snapshots, metric trend chart, drift flag, automatic alert.

### F. Gemini Explanation Module
“why this changed” summary, “what policy triggered” summary, short reviewer-friendly explanation.

### G. Audit Log
SQLite or CSV history, exportable for the deck and demo.
