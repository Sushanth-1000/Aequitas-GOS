import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { CheckCircle, FileText, RotateCcw, AlertTriangle, ArrowRight, ShieldCheck, ShieldAlert } from "lucide-react";
import type { Applicant } from "../data/mockData";
import HelpTooltip from "./HelpTooltip";
import { apiUrl } from "../api/client";

interface AuditOverrideProps {
  applicant: Applicant;
  governanceActive: boolean;
}

export default function AuditOverride({ applicant, governanceActive }: AuditOverrideProps) {
  const [income, setIncome] = useState(applicant.income);
  const [credit, setCredit] = useState(applicant.creditScore);
  const [age, setAge] = useState(applicant.age);
  const [dti, setDti] = useState(applicant.dti);
  const [loan, setLoan] = useState(applicant.loanAmount);
  const [approved, setApproved] = useState(false);

  const [simScore, setSimScore] = useState(applicant.adjustedScore);
  const [shapData, setShapData] = useState([...applicant.shapValues].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)));
  const [finalDecision, setFinalDecision] = useState(applicant.finalDecision);
  const [explanation, setExplanation] = useState(applicant.explanation);
  const [isExplaining, setIsExplaining] = useState(false);
  const [correctionDetail, setCorrectionDetail] = useState(applicant.correctionDetail || null);

  // Sync state if applicant changes
  useEffect(() => {
    setIncome(applicant.income);
    setCredit(applicant.creditScore);
    setAge(applicant.age);
    setDti(applicant.dti);
    setLoan(applicant.loanAmount);
    setApproved(false);
    setSimScore(applicant.adjustedScore);
    setShapData([...applicant.shapValues].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)));
    setFinalDecision(applicant.finalDecision);
    setExplanation(applicant.explanation);
    setCorrectionDetail(applicant.correctionDetail || null);
  }, [applicant]);

  // Real-time backend simulation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetch(apiUrl("/api/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          income, 
          creditScore: credit, 
          age, 
          dti, 
          loanAmount: loan,
          employmentYears: applicant.employmentYears || 0,
          gender: applicant.gender, 
          zipCode: applicant.zipCode, 
          applicantId: applicant.id,
          governanceActive
        })
      })
      .then(res => res.json())
      .then(data => {
        setSimScore(data.adjustedScore);
        setFinalDecision(data.finalDecision);
        if (data.shapValues) {
            setShapData([...data.shapValues].sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value)));
        }
        if (data.correctionDetail) {
          setCorrectionDetail(data.correctionDetail);
        } else {
          setCorrectionDetail(null);
        }
      })
      .catch(err => console.error("Simulation error:", err));
    }, 300); // 300ms debounce
    return () => clearTimeout(timeoutId);
  }, [income, credit, age, dti, loan, governanceActive, applicant]);

  const resetSliders = () => {
    setIncome(applicant.income);
    setCredit(applicant.creditScore);
    setAge(applicant.age);
    setDti(applicant.dti);
    setLoan(applicant.loanAmount);
    setApproved(false);
  };

  const clearSimulation = () => {
    setIncome(applicant.income);
    setCredit(applicant.creditScore);
    setAge(applicant.age);
    setDti(applicant.dti);
    setLoan(applicant.loanAmount);
    setApproved(false);
    setSimScore(applicant.adjustedScore);
    setShapData([...applicant.shapValues].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)));
    setFinalDecision(applicant.finalDecision);
    setExplanation(applicant.explanation);
    setCorrectionDetail(applicant.correctionDetail || null);
  };

  const handleGenerateExplanation = () => {
    setIsExplaining(true);
    fetch(apiUrl("/api/explain"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_id: applicant.id,
        original_score: simScore,
        policy_rule: governanceActive ? "Active Governance Rule" : "None",
        final_decision: finalDecision,
        top_feature: shapData.length > 0 ? shapData[0].feature : "Unknown"
      })
    })
    .then(res => res.json())
    .then(data => {
      setExplanation(data.explanation);
      setIsExplaining(false);
    })
    .catch(err => {
      console.error(err);
      setIsExplaining(false);
    });
  };

  const handleApproveOverride = () => {
    fetch(apiUrl("/api/audit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant_id: applicant.id,
        original_score: applicant.originalScore,
        adjusted_score: simScore,
        final_decision: finalDecision === "Approved",
        policy_applied: governanceActive ? "Active" : "None",
        gemini_explanation: explanation,
        Income: income,
        Credit_Score: credit,
        Age: age,
        Employment_Years: applicant.employmentYears || 0,
        Debt_to_Income: dti,
        Gender: applicant.gender,
        Zip_Code: applicant.zipCode,
        Loan_Amount: loan
      })
    })
    .then(res => res.json())
    .then(data => {
      setApproved(true);
      if (data.pdfBase64) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.pdfBase64}`;
        link.download = `audit_report_${applicant.id}.pdf`;
        link.click();
      }
    })
    .catch(err => console.error(err));
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    borderColor: "var(--border-default)",
    boxShadow: "var(--shadow-sm)",
  };

  const labelStyle: React.CSSProperties = { color: "var(--text-secondary)" };
  const headingStyle: React.CSSProperties = { color: "var(--text-primary)" };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT COLUMN */}
      <div className="space-y-5">
        {/* What-If Simulator */}
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center" style={headingStyle}>What-If Simulator
              <HelpTooltip text="Adjust Income, Credit Score, Age, DTI, and Loan Amount using sliders to simulate how different values affect the model's prediction in real-time. Useful for understanding which changes could flip a Denied outcome to Approved." />
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={clearSimulation}
                className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer border"
                style={{ color: "var(--danger)", background: "var(--danger-surface)", borderColor: "var(--danger)" }}
              >
                <RotateCcw className="w-3 h-3" /> Clear Simulation
              </button>
              <button
                onClick={resetSliders}
                className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer"
                style={{ color: "var(--text-secondary)", background: "var(--bg-surface-alt)" }}
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: "Income", value: income, set: setIncome, min: 20000, max: 200000, step: 1000, fmt: (v: number) => `$${v.toLocaleString()}` },
              { label: "Credit Score", value: credit, set: setCredit, min: 300, max: 850, step: 5, fmt: (v: number) => String(v) },
              { label: "Age", value: age, set: setAge, min: 18, max: 80, step: 1, fmt: (v: number) => String(v) },
              { label: "DTI Ratio", value: dti, set: setDti, min: 0.05, max: 0.65, step: 0.01, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
              { label: "Loan Amount", value: loan, set: setLoan, min: 50000, max: 800000, step: 5000, fmt: (v: number) => `$${v.toLocaleString()}` },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={labelStyle}>{s.label}</span>
                  <span className="font-medium font-mono" style={headingStyle}>{s.fmt(s.value)}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--accent) ${((s.value - s.min) / (s.max - s.min)) * 100}%, var(--border-default) ${((s.value - s.min) / (s.max - s.min)) * 100}%)`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Decision Metrics */}
        <div className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4 flex items-center" style={headingStyle}>Decision Metrics
            <HelpTooltip text="Shows three scores side-by-side: Original (raw model output), Adjusted (after bias correction by CAFP), and Simulated (live What-If result). The Final Decision reflects whether governance is active." />
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Original Score", value: applicant.originalScore, color: "var(--danger)" },
              { label: "Adjusted Score", value: governanceActive ? applicant.adjustedScore : applicant.originalScore, color: "var(--warning)" },
              { label: "Simulated", value: simScore, color: "var(--accent)" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg p-3 text-center border" style={{ background: "var(--bg-surface-alt)", borderColor: "var(--border-subtle)" }}>
                <p className="text-[10px] uppercase tracking-wider font-medium mb-1" style={labelStyle}>{m.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: m.color }}>
                  {m.value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg p-3 border" style={{ background: "var(--bg-surface-alt)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={labelStyle}>Final Decision</span>
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                style={{
                  background: finalDecision === "Approved" ? "var(--success-surface)" : finalDecision === "Denied" ? "var(--danger-surface)" : "var(--warning-surface)",
                  color: finalDecision === "Approved" ? "var(--success)" : finalDecision === "Denied" ? "var(--danger)" : "var(--warning)",
                }}
              >
                {governanceActive ? finalDecision : "Raw Output"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-5">
        {/* SHAP Chart */}
        <div className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4 flex items-center" style={headingStyle}>SHAP Feature Importance
            <HelpTooltip text="SHAP (SHapley Additive exPlanations) shows how much each feature pushed the score up (green) or down (red). Longer bars = more impact. Use this to understand why the model approved or denied this applicant." />
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={shapData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--chart-text)" }} axisLine={{ stroke: "var(--chart-grid)" }} tickLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: "var(--chart-text)" }} width={90} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-md)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
                formatter={(value) => [Number(value).toFixed(3), "SHAP Value"]}
              />
              <ReferenceLine x={0} stroke="var(--chart-grid)" />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {shapData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.value < 0 ? "var(--danger)" : "var(--success)"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bias Correction — Counterfactual + CAFP Block */}
        {correctionDetail && (
          <div className="rounded-xl border p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              {correctionDetail.correctionApplied ? (
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--success)" }} />
              ) : (
                <ShieldAlert className="w-4 h-4" style={{ color: "var(--warning)" }} />
              )}
              <h3 className="text-sm font-semibold flex items-center" style={headingStyle}>
                {correctionDetail.correctionApplied ? "CAFP Bias Correction Applied" : "Bias Detected (Correction Inactive)"}
                <HelpTooltip text="CAFP (Counterfactual Averaging for Fair Predictions) corrects bias by averaging the original score with a counterfactual score — what the applicant would have scored without historical discrimination. Final = (Original + Counterfactual) / 2." />
              </h3>
            </div>

            {/* Bias Reasons */}
            {correctionDetail.biasReasons && correctionDetail.biasReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {correctionDetail.biasReasons.map((reason, i) => (
                  <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--danger-surface)", color: "var(--danger)" }}>
                    {reason}
                  </span>
                ))}
              </div>
            )}

            {/* Three-score comparison: Original → Counterfactual → CAFP */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-stretch">
              {/* ORIGINAL */}
              <div className="rounded-lg p-3 border text-center" style={{ background: "var(--danger-surface)", borderColor: "var(--danger)" }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--danger)" }}>Original</p>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--danger)" }}>{correctionDetail.beforeScore.toFixed(2)}</p>
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{
                  background: correctionDetail.beforeDecision === "Approved" ? "var(--success-surface)" : "var(--danger-surface)",
                  color: correctionDetail.beforeDecision === "Approved" ? "var(--success)" : "var(--danger)",
                }}>{correctionDetail.beforeDecision}</span>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>Biased output</p>
              </div>
              <div className="flex items-center"><ArrowRight className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} /></div>
              {/* COUNTERFACTUAL */}
              <div className="rounded-lg p-3 border text-center" style={{ background: "var(--accent-surface)", borderColor: "var(--accent)" }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--accent)" }}>Counterfactual</p>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--accent)" }}>{(correctionDetail.counterfactualScore ?? 0).toFixed(2)}</p>
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{ background: "var(--accent-surface)", color: "var(--accent)" }}>
                  Δ {(correctionDetail.counterfactualGap ?? 0).toFixed(3)}
                </span>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>Without bias</p>
              </div>
              <div className="flex items-center"><ArrowRight className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} /></div>
              {/* CAFP CORRECTED */}
              <div className="rounded-lg p-3 border text-center" style={{
                background: correctionDetail.correctionApplied ? "var(--success-surface)" : "var(--warning-surface)",
                borderColor: correctionDetail.correctionApplied ? "var(--success)" : "var(--warning)"
              }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: correctionDetail.correctionApplied ? "var(--success)" : "var(--warning)" }}>
                  {correctionDetail.correctionApplied ? "CAFP" : "No Fix"}
                </p>
                <p className="text-xl font-bold font-mono" style={{ color: correctionDetail.correctionApplied ? "var(--success)" : "var(--warning)" }}>
                  {correctionDetail.afterScore.toFixed(2)}
                </p>
                <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1" style={{
                  background: correctionDetail.afterDecision === "Approved" ? "var(--success-surface)" : "var(--danger-surface)",
                  color: correctionDetail.afterDecision === "Approved" ? "var(--success)" : "var(--danger)",
                }}>{correctionDetail.afterDecision}</span>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {correctionDetail.correctionApplied ? "(orig+cf)/2" : "Gov off"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Explanation */}
        <div className="rounded-xl border p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
             <h3 className="text-sm font-semibold flex items-center" style={headingStyle}>AI Explanation
               <HelpTooltip text="Powered by Gemini. Click 'Generate Details' to get a plain-language explanation of why this decision was made, what the top contributing factors were, and any fairness concerns flagged by the system." />
             </h3>
             <button 
                onClick={handleGenerateExplanation} 
                disabled={isExplaining}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1"
                style={{ background: "var(--bg-surface-alt)", color: "var(--text-primary)", borderColor: "var(--border-default)" }}
             >
                {isExplaining ? "Calling Gemini..." : "✨ Generate Details"}
             </button>
          </div>
          <div className="rounded-lg p-4 text-sm leading-relaxed border" style={{ background: "var(--bg-surface-alt)", color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }}>
            {explanation}
          </div>
        </div>

        {/* Action & Audit */}
        <div className="rounded-xl border p-5" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-3 flex items-center" style={headingStyle}>Action & Audit
            <HelpTooltip text="Human-in-the-loop override panel. 'Approve with Override' records a compliance audit entry with your reviewer ID, timestamps the decision, and generates a downloadable PDF audit report. Only use after reviewing SHAP and bias details." />
          </h3>
          {approved ? (
            <div className="flex items-center gap-2 rounded-lg p-3" style={{ background: "var(--success-surface)" }}>
              <CheckCircle className="w-5 h-5" style={{ color: "var(--success)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
                Applicant {applicant.id} manually approved. Audit trail recorded.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleApproveOverride}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer"
                style={{ background: "var(--success)", boxShadow: "var(--shadow-sm)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <CheckCircle className="w-4 h-4" />
                Approve with Override
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all cursor-pointer"
                style={{ color: "var(--text-secondary)", borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
              >
                <FileText className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          )}
          {applicant.biasStatus === "Biased" && !approved && (
            <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg" style={{ background: "var(--warning-surface)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
              <p className="text-xs" style={{ color: "var(--warning)" }}>
                This applicant has bias flags. Approving will create a compliance audit record under your reviewer ID.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
