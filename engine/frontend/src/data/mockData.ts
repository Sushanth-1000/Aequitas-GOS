export interface CorrectionDetail {
  beforeScore: number;
  beforeDecision: string;
  afterScore: number;
  afterDecision: string;
  ruleApplied: string;
  correctionApplied: boolean;
  counterfactualScore?: number;
  counterfactualGap?: number;
  method?: string;
  biasReasons?: string[];
}

export interface Applicant {
  id: string;
  name: string;
  gender: "Male" | "Female" | "Non-Binary";
  zipCode: string;
  income: number;
  creditScore: number;
  age: number;
  dti: number;
  loanAmount: number;
  employmentYears: number;
  biasStatus: "Biased" | "Non-Biased";
  decisionStatus: "Approved" | "Auto-Corrected" | "Needs Review";
  originalScore: number;
  adjustedScore: number;
  finalDecision: "Approved" | "Denied" | "Review";
  shapValues: { feature: string; value: number }[];
  correctionDetail?: CorrectionDetail | null;
  counterfactualScore?: number;
  counterfactualGap?: number;
  explanation: string;
}

export const applicants: Applicant[] = [
  {
    id: "APP-10291",
    name: "Maria Gonzalez",
    gender: "Female",
    zipCode: "30301",
    income: 58000,
    creditScore: 710,
    age: 34,
    dti: 0.32,
    loanAmount: 180000,
    biasStatus: "Biased",
    decisionStatus: "Needs Review",
    originalScore: 0.42,
    adjustedScore: 0.71,
    finalDecision: "Review",
    shapValues: [
      { feature: "Gender", value: -0.28 },
      { feature: "Zip Code", value: -0.15 },
      { feature: "Income", value: 0.12 },
      { feature: "Credit Score", value: 0.22 },
      { feature: "Age", value: 0.05 },
      { feature: "DTI Ratio", value: -0.08 },
      { feature: "Loan Amount", value: -0.04 },
    ],
    explanation:
      "Significant gender-based bias detected. The model assigned a 28% negative weight to gender, which violates ECOA fair lending rules. Zip code correlation with protected demographics also flagged. After governance correction, the applicant's score improved from 0.42 → 0.71, warranting manual review.",
  },
  {
    id: "APP-10292",
    name: "James Chen",
    gender: "Male",
    zipCode: "94102",
    income: 92000,
    creditScore: 780,
    age: 41,
    dti: 0.21,
    loanAmount: 320000,
    biasStatus: "Non-Biased",
    decisionStatus: "Approved",
    originalScore: 0.88,
    adjustedScore: 0.87,
    finalDecision: "Approved",
    shapValues: [
      { feature: "Gender", value: 0.02 },
      { feature: "Zip Code", value: 0.05 },
      { feature: "Income", value: 0.31 },
      { feature: "Credit Score", value: 0.35 },
      { feature: "Age", value: 0.03 },
      { feature: "DTI Ratio", value: 0.09 },
      { feature: "Loan Amount", value: -0.02 },
    ],
    explanation:
      "No significant bias detected. Score is driven primarily by strong credit history (780) and high income-to-loan ratio. Gender and zip code contributions are negligible. Decision: auto-approved with no governance intervention required.",
  },
  {
    id: "APP-10293",
    name: "Aisha Patel",
    gender: "Female",
    zipCode: "60614",
    income: 47000,
    creditScore: 660,
    age: 27,
    dti: 0.38,
    loanAmount: 150000,
    biasStatus: "Biased",
    decisionStatus: "Auto-Corrected",
    originalScore: 0.38,
    adjustedScore: 0.62,
    finalDecision: "Approved",
    shapValues: [
      { feature: "Gender", value: -0.22 },
      { feature: "Zip Code", value: -0.1 },
      { feature: "Income", value: -0.05 },
      { feature: "Credit Score", value: 0.1 },
      { feature: "Age", value: -0.08 },
      { feature: "DTI Ratio", value: -0.12 },
      { feature: "Loan Amount", value: 0.02 },
    ],
    explanation:
      "Gender bias correction applied automatically. The original model penalized gender by 22% and age by 8%. After removing protected-class influence and recalculating with policy engine rules, the adjusted score of 0.62 meets the approval threshold. Auto-corrected and approved per Policy Rule FLR-2024-07.",
  },
  {
    id: "APP-10294",
    name: "Robert Williams",
    gender: "Male",
    zipCode: "10001",
    income: 125000,
    creditScore: 810,
    age: 52,
    dti: 0.15,
    loanAmount: 450000,
    biasStatus: "Non-Biased",
    decisionStatus: "Approved",
    originalScore: 0.94,
    adjustedScore: 0.93,
    finalDecision: "Approved",
    shapValues: [
      { feature: "Gender", value: 0.01 },
      { feature: "Zip Code", value: 0.08 },
      { feature: "Income", value: 0.38 },
      { feature: "Credit Score", value: 0.4 },
      { feature: "Age", value: 0.04 },
      { feature: "DTI Ratio", value: 0.12 },
      { feature: "Loan Amount", value: -0.06 },
    ],
    explanation:
      "Exemplary risk profile. High credit score, strong income, and low DTI ratio all contribute positively. No protected-class bias detected. Governance layer confirms decision integrity.",
  },
  {
    id: "APP-10295",
    name: "Taylor Nguyen",
    gender: "Non-Binary",
    zipCode: "97201",
    income: 63000,
    creditScore: 690,
    age: 30,
    dti: 0.29,
    loanAmount: 200000,
    biasStatus: "Biased",
    decisionStatus: "Needs Review",
    originalScore: 0.35,
    adjustedScore: 0.64,
    finalDecision: "Review",
    shapValues: [
      { feature: "Gender", value: -0.31 },
      { feature: "Zip Code", value: -0.06 },
      { feature: "Income", value: 0.08 },
      { feature: "Credit Score", value: 0.14 },
      { feature: "Age", value: -0.03 },
      { feature: "DTI Ratio", value: 0.04 },
      { feature: "Loan Amount", value: -0.05 },
    ],
    explanation:
      "Critical bias alert: Gender encoding contributed a -31% weight, the highest observed in this batch. The model's training data underrepresents non-binary applicants, causing severe prediction skew. Manual review required per compliance protocol CP-2024-12.",
  },
  {
    id: "APP-10296",
    name: "Sarah Kim",
    gender: "Female",
    zipCode: "02101",
    income: 78000,
    creditScore: 740,
    age: 38,
    dti: 0.25,
    loanAmount: 275000,
    biasStatus: "Biased",
    decisionStatus: "Auto-Corrected",
    originalScore: 0.55,
    adjustedScore: 0.76,
    finalDecision: "Approved",
    shapValues: [
      { feature: "Gender", value: -0.19 },
      { feature: "Zip Code", value: 0.03 },
      { feature: "Income", value: 0.18 },
      { feature: "Credit Score", value: 0.26 },
      { feature: "Age", value: 0.02 },
      { feature: "DTI Ratio", value: 0.06 },
      { feature: "Loan Amount", value: -0.07 },
    ],
    explanation:
      "Moderate gender bias detected and auto-corrected. Income and credit score are strong positive predictors. After governance correction, the applicant comfortably exceeds the 0.60 approval threshold.",
  },
  {
    id: "APP-10297",
    name: "David Brown",
    gender: "Male",
    zipCode: "77001",
    income: 41000,
    creditScore: 620,
    age: 24,
    dti: 0.42,
    loanAmount: 120000,
    biasStatus: "Non-Biased",
    decisionStatus: "Needs Review",
    originalScore: 0.31,
    adjustedScore: 0.33,
    finalDecision: "Denied",
    shapValues: [
      { feature: "Gender", value: 0.01 },
      { feature: "Zip Code", value: -0.08 },
      { feature: "Income", value: -0.15 },
      { feature: "Credit Score", value: -0.12 },
      { feature: "Age", value: -0.1 },
      { feature: "DTI Ratio", value: -0.18 },
      { feature: "Loan Amount", value: -0.03 },
    ],
    explanation:
      "No significant protected-class bias detected. The low score is driven by legitimate risk factors: below-average credit (620), high DTI (0.42), and low income relative to loan amount. Decision upheld as fair denial.",
  },
  {
    id: "APP-10298",
    name: "Lisa Martinez",
    gender: "Female",
    zipCode: "85001",
    income: 52000,
    creditScore: 700,
    age: 45,
    dti: 0.34,
    loanAmount: 190000,
    biasStatus: "Biased",
    decisionStatus: "Needs Review",
    originalScore: 0.44,
    adjustedScore: 0.68,
    finalDecision: "Review",
    shapValues: [
      { feature: "Gender", value: -0.24 },
      { feature: "Zip Code", value: -0.12 },
      { feature: "Income", value: 0.06 },
      { feature: "Credit Score", value: 0.18 },
      { feature: "Age", value: 0.07 },
      { feature: "DTI Ratio", value: -0.06 },
      { feature: "Loan Amount", value: -0.03 },
    ],
    explanation:
      "Dual bias detected: Gender (-24%) and Zip Code (-12%) both show discriminatory weighting. Zip code 85001 has high correlation with Hispanic demographic data, triggering disparate impact analysis. Escalated for manual review.",
  },
];

export const policyRules = {
  version: "2.4.1",
  lastUpdated: "2026-04-25T08:30:00Z",
  engine: "Aequitas Policy Engine v3",
  rules: [
    {
      id: "FLR-2024-07",
      name: "Gender Bias Correction",
      description: "Remove gender feature contribution when |SHAP| > 0.10",
      action: "RECALCULATE_WITHOUT_FEATURE",
      threshold: 0.1,
      status: "ACTIVE",
    },
    {
      id: "FLR-2024-08",
      name: "Zip Code Proxy Detection",
      description: "Flag zip codes correlated >0.7 with protected demographics",
      action: "FLAG_FOR_REVIEW",
      threshold: 0.7,
      status: "ACTIVE",
    },
    {
      id: "FLR-2024-09",
      name: "Age Discrimination Guard",
      description: "Cap age feature influence at ±5% of total score",
      action: "CAP_FEATURE_INFLUENCE",
      threshold: 0.05,
      status: "ACTIVE",
    },
    {
      id: "FLR-2024-10",
      name: "Disparate Impact Ratio",
      description: "Alert when approval rate ratio falls below 0.8 (4/5 rule)",
      action: "ALERT_COMPLIANCE",
      threshold: 0.8,
      status: "ACTIVE",
    },
    {
      id: "FLR-2024-11",
      name: "Score Adjustment Ceiling",
      description: "Governance adjustments capped at 0.35 score delta max",
      action: "CAP_ADJUSTMENT",
      threshold: 0.35,
      status: "ACTIVE",
    },
  ],
};

export const driftMetrics = {
  psi: { value: 0.18, threshold: 0.2, status: "warning" as const },
  globalDIR: { value: 0.83, threshold: 0.8, status: "ok" as const },
  modelAccuracy: { value: 0.91, trend: "stable" as const },
  lastRetrained: "2026-04-20T14:00:00Z",
  dataPoints: 14823,
  alertHistory: [
    { date: "2026-04-24", type: "PSI Warning", message: "PSI approaching threshold (0.18/0.20)" },
    { date: "2026-04-22", type: "DIR Alert", message: "DIR dropped to 0.79 for zip group 300xx — corrective action applied" },
    { date: "2026-04-18", type: "Drift Detected", message: "Income distribution shift detected in batch 2024-Q1-R3" },
  ],
};
