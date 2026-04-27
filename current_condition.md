# Aequitas-Gov — Current Project Documentation

> **Last updated:** 2026-04-28  
> **Status:** Active Development — FastAPI + React migration complete

---

## 1. Project Overview

**Aequitas-Gov** is a real-time AI governance and fairness layer for loan approval systems. It sits between a standard ML credit-risk model and the final lending decision, providing:

- **Bias Detection** — Hybrid counterfactual + subgroup analysis at the individual applicant level
- **Bias Correction** — CAFP (Counterfactual Averaging for Fair Predictions) post-processing
- **Explainability** — SHAP feature importance + Gemini-powered plain-English explanations
- **Human-in-the-Loop Oversight** — Manual audit, override, and immutable audit trail with PDF reports
- **Drift Monitoring** — Population Stability Index (PSI) tracking with retrain alerts
- **Multi-Dimensional Fairness** — Hypothesis-tested fairness metrics across Gender, Zip Code, Age, Income, and intersectional groups

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                │
│              localhost:5173 — TypeScript + Tailwind      │
│  ┌──────────────┬──────────────┬───────────────────┐    │
│  │ ApplicantQueue│ AuditOverride│ SystemMetrics     │    │
│  │ (Tab 1)       │ (Tab 2)      │ (Tab 3)           │    │
│  └──────────────┴──────────────┴───────────────────┘    │
│                         │ HTTP REST                      │
└─────────────────────────┼───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│               FastAPI Backend (api.py)                   │
│                   localhost:8000                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ /api/applicants  — Batch score + tag 100 records │    │
│  │ /api/simulate    — Single-applicant What-If      │    │
│  │ /api/fairness    — Multi-dimensional metrics     │    │
│  │ /api/explain     — Gemini explanation            │    │
│  │ /api/audit       — Log + PDF generation          │    │
│  │ /api/policy      — GET/PUT policy configuration  │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌──────────── Core Modules ───────────────────────┐    │
│  │ bias_detector → bias_corrector → policy engine  │    │
│  │ bias_calculator │ explainability │ logger │ drift│    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌──────────── ML Artifacts ───────────────────────┐    │
│  │ models/model.pkl  (sklearn LogReg pipeline)      │    │
│  │ models/explainer.pkl  (SHAP LinearExplainer)     │    │
│  │ models/features.pkl  (feature name list)         │    │
│  │ data/synthetic_applicants.csv  (1001 records)    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Legacy:** `app.py` is the original Streamlit prototype. It is no longer in the primary execution path but remains in the repo for reference.

---

## 3. Directory Structure

```
Unbiased AI/
├── current_condition.md          ← This file
├── demonstration.md              ← Demo script
├── specification.md              ← Original specification
├── implementation.md             ← Implementation plan
├── upgraded_plan2.md             ← Upgraded plan document
│
└── engine/
    ├── api.py                    ← FastAPI backend (primary)
    ├── app.py                    ← Streamlit app (legacy)
    ├── data_generator.py         ← Synthetic dataset generator
    ├── train_model.py            ← Model training script
    ├── test_cafp.py              ← Quick fairness API test
    ├── start.ps1                 ← PowerShell launcher script
    ├── requirements.txt          ← Python dependencies
    ├── Dockerfile                ← Container config (legacy, targets Streamlit)
    ├── fallback_log.json         ← Local audit log fallback
    │
    ├── core/                     ← Core governance modules
    │   ├── audit.py              ← Feature validation & DPD/DIR calculator
    │   ├── bias_calculator.py    ← Multi-dimensional hypothesis-tested fairness
    │   ├── bias_corrector.py     ← CAFP correction algorithm
    │   ├── bias_detector.py      ← Counterfactual + subgroup bias detection
    │   ├── drift.py              ← PSI-based drift monitoring
    │   ├── explainability.py     ← Gemini API integration
    │   ├── logger.py             ← Firestore logging + PDF report generation
    │   └── policy.py             ← Rule-based policy enforcement engine
    │
    ├── models/                   ← Serialized ML artifacts
    │   ├── model.pkl             ← Trained sklearn pipeline
    │   ├── explainer.pkl         ← SHAP explainer
    │   └── features.pkl          ← Feature name mapping
    │
    ├── data/
    │   └── synthetic_applicants.csv
    │
    └── frontend/                 ← React SPA
        ├── package.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── main.tsx          ← Entry point
            ├── App.tsx           ← Root component with tabs + nav
            ├── App.css           ← Component-level styles
            ├── index.css         ← Design system (CSS custom properties, light/dark)
            ├── components/
            │   ├── ApplicantQueue.tsx    ← Tab 1: Applicant listing with filters
            │   ├── AuditOverride.tsx     ← Tab 2: What-If simulator + SHAP + CAFP
            │   ├── SystemMetrics.tsx     ← Tab 3: Policy editor + fairness + drift
            │   ├── GovernanceBanner.tsx  ← Governance ON/OFF toggle banner
            │   └── HelpTooltip.tsx       ← Reusable contextual help component
            ├── data/
            │   └── mockData.ts          ← Type definitions + fallback mock data
            └── hooks/
                └── useTheme.ts          ← Light/dark theme hook
```

---

## 4. Backend — Core Modules (Detailed)

### 4.1 `data_generator.py` — Synthetic Data Generator

- Generates 1000 synthetic loan applicants with: Income, Credit_Score, Age, Employment_Years, Debt_to_Income, Gender, Zip_Code, Loan_Amount
- **Injects historical bias**: Female applicants get Credit_Score −50 and Income ×0.85 to simulate real-world pay gap / credit discrimination
- Force-inserts a demonstration record `A001` (Female, $45k income, 620 credit, zip 10001)
- Outputs to `data/synthetic_applicants.csv`

### 4.2 `train_model.py` — Model Training

- **Feature whitelist**: `Income, Credit_Score, Employment_Years, Debt_to_Income, Loan_Amount` (protected attributes like Gender, Age, Zip_Code are deliberately excluded from model features)
- Pipeline: `SimpleImputer(median) → StandardScaler → LogisticRegression(balanced, max_iter=500)`
- Target: `Default_History` (1 = default)
- SHAP: `LinearExplainer` fitted on the transformed training data
- Saves: `model.pkl`, `explainer.pkl`, `features.pkl`

### 4.3 `core/bias_detector.py` — Hybrid Bias Detection

**Two detection strategies run on every applicant:**

1. **Counterfactual Fairness Gap**
   - Constructs a "counterfactual" applicant: reverses known discrimination adjustments (e.g., for Female: Income / 0.85, Credit_Score + 50)
   - Scores both the original and counterfactual through the model
   - If `|score_orig − score_cf| > cf_threshold` (default 0.05), flags as counterfactually biased
   - Returns the counterfactual score, gap, and adjusted feature values

2. **Subgroup Bias (Simplified FairTree)**
   - Groups applicants by Gender × Income bracket (low/mid/high)
   - Computes the subgroup approval rate vs. overall approval rate
   - If deviation > 15%, flags as subgroup-biased

- **Combined**: `is_biased = cf_biased OR sub_biased`

### 4.4 `core/bias_corrector.py` — CAFP Algorithm

```
CAFP:   final_score = (original_score + counterfactual_score) / 2
```

- A black-box post-processing method that removes dependence on protected attributes by averaging factual and counterfactual predictions
- Also provides a weighted variant: `cafp_correct_weighted(orig, cf, weight=0.5)`

### 4.5 `core/bias_calculator.py` — Multi-Dimensional Fairness

Runs **hypothesis-tested fairness** across 5 dimensions:

| Dimension | Groups | Reference Group |
|---|---|---|
| **Gender** | Male, Female, Other | Male |
| **Zip Code** | Flagged Zip, Unflagged Zip | Unflagged Zip |
| **Age Bracket** | 18-30, 31-50, 51+ | 31-50 |
| **Income Bracket** | Low (<50k), Mid (50-80k), High (80k+) | High (80k+) |
| **Intersectional** | Gender × Income (e.g., Female + LowInc) | Male + HighInc |

**For each group:**
- Computes selection/approval rate
- Calculates Disparate Impact Ratio (DIR = group_rate / reference_rate)
- Runs a two-proportion z-test (p-value)
- Computes Wilson confidence intervals
- Verdict: `Significant Disparity` (p < 0.05 AND DIR < 0.8), `Disparity (not significant)`, or `Fair`

**Flagged Zip Prefixes:** 303 (Atlanta), 850 (Phoenix), 900 (LA), 100 (NYC), 606 (Chicago)

### 4.6 `core/policy.py` — Policy Enforcement Engine

- **Modes**: `enforcement` (active) or `shadow` (passive/logging only)
- **Rule types**:
  - `score_multiplier`: Multiplies score by a factor (capped at 1.0)
  - `score_additive`: Adds a fixed bonus (capped at 1.0)
  - `hard_reject`: Forces score to 0.0
- **Target group matching**: Supports `Gender=Female`, `Gender=Non-Binary`, `Gender=All-Protected`, `ZipCode=Proxy`
- Rules are cumulative and sorted by priority

### 4.7 `core/explainability.py` — Gemini Integration

- Calls `gemini-2.5-flash` with a structured prompt containing applicant ID, score, policy rule, decision, and top SHAP feature
- Returns JSON: `{"explanation": "<3-sentence plain-English summary>"}`
- Falls back to a static explanation when the API key is not configured

### 4.8 `core/logger.py` — Audit Logging & PDF Reports

- **Primary**: Writes audit records to Google Cloud Firestore (`loan_audits` collection)
- **Fallback**: If Firestore is unavailable, appends to `fallback_log.json`
- **PDF Generation**: Uses ReportLab to generate compliance audit PDFs with applicant profile, scores, decision, and explanation

### 4.9 `core/audit.py` — Feature Validation

- `validate_features_for_inference()`: Ensures protected attributes (Age, Gender, Zip_Code) are NOT in the model inference whitelist (catches feature leakage)
- `calculate_fairness()`: Simple DPD/DIR calculation for protected vs. unprotected groups

### 4.10 `core/drift.py` — Drift Monitoring

- Computes Population Stability Index (PSI) between reference and current batches
- **Alert threshold**: PSI > 0.2 triggers a drift alert
- Tracks PSI for Income and Credit_Score distributions

---

## 5. Backend — API Endpoints (`api.py`)

### Startup

- Loads `model.pkl`, `explainer.pkl`, `features.pkl`, and `synthetic_applicants.csv`
- Initializes mutable `policy_state` with threshold (0.65), counterfactual adjustments, and 3 decision rules
- Pre-computes fairness metrics cache on startup

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/applicants` | Batch-scores first 100 applicants: model inference, SHAP, bias detection (counterfactual + subgroup), CAFP correction, and decision tagging. Returns full applicant objects with names, scores, SHAP values, bias status, correction details. |
| `POST` | `/api/simulate` | Single-applicant What-If: accepts slider values (income, credit, age, DTI, loan, gender, zip, governance toggle). Runs full pipeline: score → SHAP → bias detect → CAFP correct → decision. |
| `GET` | `/api/fairness` | Returns cached multi-dimensional fairness metrics (all 5 dimensions with hypothesis tests). |
| `POST` | `/api/explain` | Sends context to Gemini and returns a plain-English explanation. |
| `POST` | `/api/audit` | Logs the audit record to Firestore/fallback + generates a base64 PDF report. |
| `GET` | `/api/policy` | Returns current policy state (threshold, rules, CF adjustments). |
| `PUT` | `/api/policy` | Updates policy state. Recomputes fairness metrics with new threshold. |

### Inference Pipeline (per-applicant)

```
1. Model Scoring      → predict_proba → raw probability (class 0 = approve)
2. SHAP Explainability → LinearExplainer → per-feature impact values
3. Bias Detection      → Counterfactual gap + Subgroup deviation → is_biased flag
4. Bias Correction     → If biased + governance ON → CAFP: (orig + cf) / 2
5. Policy Enforcement  → If not biased + governance ON → cumulative rule-based adjustment
6. Decision Status     → Auto-Corrected / Needs Review / Approved
```

### Decision Status Logic

| Governance | Biased? | Final Decision | Status |
|---|---|---|---|
| ON | Yes | Approved (after CAFP) | Auto-Corrected |
| ON | Yes | Denied (after CAFP) | Needs Review |
| ON | No | Approved | Approved |
| ON | No | Denied | Needs Review |
| OFF | Yes | — | Needs Review |
| OFF | No | Approved | Approved |
| OFF | No | Denied | Needs Review |

---

## 6. Frontend — React Application

### 6.1 Technology Stack

- **React 19** with TypeScript
- **Vite 8** build tool
- **Tailwind CSS 4** for utility styling
- **Recharts** for SHAP bar charts
- **Lucide React** for icons
- CSS custom properties for light/dark theming

### 6.2 Design System (`index.css`)

Two theme palettes (light/dark) defined via CSS custom properties:
- `--bg-body`, `--bg-surface`, `--bg-surface-alt`, `--bg-surface-hover`, `--bg-inset`
- `--border-default`, `--border-subtle`
- `--text-primary`, `--text-secondary`, `--text-tertiary`
- `--accent`, `--success`, `--warning`, `--danger` (with `-surface` variants)
- `--shadow-sm/md/lg`, `--chart-grid`, `--chart-text`

Theme toggled via `useTheme` hook (persists to `localStorage`).

### 6.3 `App.tsx` — Root Component

- Fetches all applicants from `/api/applicants` on mount
- Manages global state: `governanceActive`, `activeTab`, `liveApplicants`, `selectedApplicant`
- Header with theme toggle (sun/moon animated switch) and governance status pill
- Three tabs: Applicant Queue, Audit & Override, System Metrics

### 6.4 `GovernanceBanner.tsx`

- Full-width banner showing governance ON/OFF status
- Animated toggle switch with green (protected) / red (unprotected) styling
- Descriptive text changes based on state

### 6.5 `ApplicantQueue.tsx` (Tab 1)

- Renders a table of all applicants from the API
- **Filters**: Search by ID/name, Bias Status dropdown, Decision Status dropdown, Review filter
- **Columns**: ID, Name, Gender, Income, Bias Status (pill), Decision (pill), Action (Audit button)
- **Bias Status pills**: `Biased` (red), `Non-Biased` (green)
- **Decision pills**: `Approved` (green), `Auto-Corrected` (yellow), `Needs Review` (red)
- Clicking "Audit" selects the applicant and switches to Tab 2
- HelpTooltips on Bias Status and Decision column headers

### 6.6 `AuditOverride.tsx` (Tab 2)

**Left Column:**
- **What-If Simulator**: 5 sliders (Income, Credit Score, Age, DTI, Loan Amount) with 300ms debounced backend calls to `/api/simulate`
- **Decision Metrics**: Three-score comparison (Original, Adjusted, Simulated) + Final Decision pill
- **Reset button** to restore original applicant values

**Right Column:**
- **SHAP Feature Importance**: Horizontal bar chart (Recharts) with red/green coloring by impact direction
- **CAFP Bias Correction Block** (shown only for biased applicants): Three-card flow: Original → Counterfactual → CAFP with scores, decisions, and gap. Shows bias reasons as pills.
- **AI Explanation**: Generate button calls `/api/explain` (Gemini)
- **Action & Audit**: "Approve with Override" button calls `/api/audit`, triggers PDF download. Warning banner for biased applicants.

### 6.7 `SystemMetrics.tsx` (Tab 3)

**Left Column:**
- **Policy Engine Configuration**: Editable threshold slider, tabbed JSON editors for Decision Rules and Counterfactual Config
- Edit/Save/Cancel workflow with live validation
- Saves to `/api/policy` PUT endpoint

**Right Column:**
- **Multi-Dimensional Fairness**: Dimension selector pills (Gender, Zip Code, Age, Income, Intersectional), per-group metrics (DIR, Rate, p-value, n, verdict), flagged dimension warnings
- **KPIs**: PSI card and Worst DIR card
- **Drift Monitoring**: Run Simulation button (animated PSI fluctuation), alert history from mock data

### 6.8 `HelpTooltip.tsx`

- Reusable tooltip component with auto-positioning (flips top↔bottom based on viewport)
- Shows on hover or click
- Used across all major section headers

### 6.9 `mockData.ts`

- TypeScript type definitions: `Applicant`, `CorrectionDetail`
- 8 fallback mock applicants (used if API is unavailable)
- `policyRules` and `driftMetrics` objects for SystemMetrics tab

---

## 7. Data Pipeline

```
data_generator.py → data/synthetic_applicants.csv → train_model.py → models/*.pkl → api.py (loads on startup)
```

1. **Generate**: `python data_generator.py` — creates 1001 synthetic applicants with injected gender bias
2. **Train**: `python train_model.py` — trains LogisticRegression pipeline + SHAP explainer
3. **Serve**: `python -m uvicorn api:app --reload --port 8000` — loads models and data, serves API
4. **Frontend**: `cd frontend && npm run dev -- --port 5173` — serves React SPA

---

## 8. How to Run

### Quick Start (PowerShell)

```powershell
cd engine
.\start.ps1
```

This script:
1. Installs Python dependencies (`pip install -r requirements.txt`)
2. Starts FastAPI backend on port 8000 (in a new window)
3. Installs frontend dependencies (`npm install`)
4. Starts React dev server on port 5173

### Manual Start

```powershell
# Terminal 1: Backend
cd engine
pip install -r requirements.txt
python -m uvicorn api:app --reload --port 8000

# Terminal 2: Frontend
cd engine/frontend
npm install
npm run dev -- --port 5173
```

### First-Time Setup (if models don't exist)

```powershell
cd engine
python data_generator.py
python train_model.py
```

---

## 9. Dependencies

### Python (`requirements.txt`)

| Package | Purpose |
|---|---|
| scikit-learn | ML model pipeline |
| shap | SHAP explainability |
| pandas | Data manipulation |
| google-genai | Gemini API for explanations |
| firebase-admin | Firestore audit logging |
| reportlab | PDF report generation |
| matplotlib | Plotting (legacy) |
| google-cloud-firestore | Firestore client |
| plotly | Interactive charts (legacy/Streamlit) |
| fastapi | REST API framework |
| uvicorn | ASGI server |
| pydantic | Request/response validation |

### Frontend (`package.json`)

| Package | Purpose |
|---|---|
| react 19 | UI framework |
| react-dom 19 | DOM renderer |
| tailwindcss 4 | Utility CSS |
| recharts | SHAP chart visualization |
| lucide-react | Icon library |
| vite 8 | Build tool |
| typescript 6 | Type safety |
| vitest | Testing framework |

---

## 10. Key Algorithms

### CAFP (Counterfactual Averaging for Fair Predictions)

```
final_score = (f(x) + f(x_cf)) / 2
```

Where `x` is the original applicant and `x_cf` is the counterfactual (what the applicant would look like without historical discrimination). This makes the prediction independent of the protected attribute.

### Disparate Impact Ratio (DIR)

```
DIR = approval_rate(protected_group) / approval_rate(reference_group)
```

Four-fifths rule: DIR < 0.8 indicates potential discrimination.

### Two-Proportion Z-Test

Used to determine if the difference in approval rates between groups is statistically significant (p < 0.05).

### Population Stability Index (PSI)

```
PSI = Σ (p_expected - p_actual) × ln(p_expected / p_actual)
```

PSI > 0.2 signals significant data drift requiring model retraining.

---

## 11. Default Policy Configuration

```json
{
  "active_mode": "enforcement",
  "threshold": 0.65,
  "counterfactual_adjustments": {
    "Female": { "Income": {"op": "divide", "value": 0.85}, "Credit_Score": {"op": "add", "value": 50} },
    "Non-Binary": { "Income": {"op": "divide", "value": 0.90}, "Credit_Score": {"op": "add", "value": 30} },
    "Male": {}
  },
  "counterfactual_threshold": 0.05,
  "decision_rules": [
    { "rule_id": "R001", "name": "Gender Bias Correction (All Protected)", "priority": 1, "condition": {"metric": "DIR", "operator": "<", "value": 0.8, "target_group": "Gender=All-Protected"}, "action": {"type": "score_multiplier", "value": 1.15}, "enabled": true },
    { "rule_id": "R002", "name": "Non-Binary Additional Boost", "priority": 2, "condition": {"metric": "DIR", "operator": "<", "value": 0.8, "target_group": "Gender=Non-Binary"}, "action": {"type": "score_additive", "value": 0.05}, "enabled": true },
    { "rule_id": "R003", "name": "Zip Code Proxy Detection", "priority": 3, "condition": {"metric": "DIR", "operator": "<", "value": 0.85, "target_group": "ZipCode=Proxy"}, "action": {"type": "score_additive", "value": 0.03}, "enabled": true }
  ]
}
```

---

## 12. Known Limitations & Notes

- **Dockerfile** still targets Streamlit (`app.py`); needs updating for FastAPI + React deployment
- **Gemini API key** is placeholder (`"YOUR API KEY"`); explanations fall back to static text
- **Firestore** gracefully degrades to local JSON logging when credentials are unavailable
- **Frontend fetches** are hardcoded to `http://localhost:8000`; no environment variable support yet
- The Gender value `"Other"` in `data_generator.py` does not match the `"Non-Binary"` label used in policy rules and counterfactual adjustments — this may cause some `Other`-gender applicants to miss counterfactual corrections
