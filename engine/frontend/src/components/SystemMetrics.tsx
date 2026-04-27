import { useState, useEffect } from "react";
import { Activity, AlertTriangle, Play, RefreshCw, TrendingUp, Clock, Save, Edit3, X, Code, FlaskConical, Layers } from "lucide-react";
import { driftMetrics } from "../data/mockData";
import HelpTooltip from "./HelpTooltip";

interface SystemMetricsProps { governanceActive: boolean; }

export default function SystemMetrics({ governanceActive }: SystemMetricsProps) {
  const [simulating, setSimulating] = useState(false);
  const [psiVal, setPsiVal] = useState(driftMetrics.psi.value);
  const [policy, setPolicy] = useState<any>(null);
  const [fairness, setFairness] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editThreshold, setEditThreshold] = useState(0.65);
  const [rulesJson, setRulesJson] = useState("");
  const [cfJson, setCfJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [editorTab, setEditorTab] = useState<"rules" | "counterfactual">("rules");
  const [fairnessDim, setFairnessDim] = useState("Gender");

  useEffect(() => {
    fetch("http://localhost:8000/api/policy").then(r => r.json()).then(data => {
      setPolicy(data); setEditThreshold(data.threshold);
      setRulesJson(JSON.stringify(data.decision_rules, null, 2));
      setCfJson(JSON.stringify(data.counterfactual_adjustments, null, 2));
    }).catch(console.error);
    fetch("http://localhost:8000/api/fairness").then(r => r.json()).then(setFairness).catch(console.error);
  }, []);

  const handleJsonChange = (val: string, which: "rules" | "cf") => {
    if (which === "rules") setRulesJson(val); else setCfJson(val);
    try { JSON.parse(val); setJsonError(""); } catch (e: any) { setJsonError(e.message); }
  };

  const handleSave = () => {
    let parsedRules, parsedCf;
    try { parsedRules = JSON.parse(rulesJson); } catch { setJsonError("Invalid Rules JSON"); return; }
    try { parsedCf = JSON.parse(cfJson); } catch { setJsonError("Invalid CF JSON"); return; }
    setSaving(true);
    fetch("http://localhost:8000/api/policy", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: editThreshold, decision_rules: parsedRules, counterfactual_adjustments: parsedCf })
    }).then(r => r.json()).then(data => {
      setPolicy(data.policy);
      setRulesJson(JSON.stringify(data.policy.decision_rules, null, 2));
      setCfJson(JSON.stringify(data.policy.counterfactual_adjustments, null, 2));
      setSaving(false); setEditing(false);
      setSaveMsg("Policy saved!"); setTimeout(() => setSaveMsg(""), 3000);
      fetch("http://localhost:8000/api/fairness").then(r => r.json()).then(setFairness).catch(console.error);
    }).catch(() => setSaving(false));
  };

  const handleCancel = () => {
    if (policy) {
      setEditThreshold(policy.threshold);
      setRulesJson(JSON.stringify(policy.decision_rules, null, 2));
      setCfJson(JSON.stringify(policy.counterfactual_adjustments, null, 2));
    }
    setJsonError(""); setEditing(false);
  };

  const runSimulation = () => {
    setSimulating(true);
    const interval = setInterval(() => setPsiVal(v => Math.max(0.01, Math.min(0.35, v + (Math.random() - 0.45) * 0.02))), 400);
    setTimeout(() => { clearInterval(interval); setSimulating(false); }, 4000);
  };

  const card: React.CSSProperties = { background: "var(--bg-surface)", borderColor: "var(--border-default)", boxShadow: "var(--shadow-sm)" };
  const hd: React.CSSProperties = { color: "var(--text-primary)" };
  const lb: React.CSSProperties = { color: "var(--text-secondary)" };

  // Get current dimension data
  const dimNames = fairness?.dimensions ? Object.keys(fairness.dimensions) : [];
  const currentDim = fairness?.dimensions?.[fairnessDim];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* LEFT: Policy Engine */}
      <div className="space-y-5">
        <div className="rounded-xl border p-5" style={card}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center" style={hd}>Policy Engine Configuration
              <HelpTooltip text="The central governance configuration. Set the approval threshold (minimum score to approve a loan), edit decision rules as JSON, and tune counterfactual adjustments used for bias correction. Changes take effect immediately and recompute fairness metrics." />
            </h3>
            <div className="flex items-center gap-2">
              {saveMsg && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full animate-pulse" style={{ background: "var(--success-surface)", color: "var(--success)" }}>{saveMsg}</span>}
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer" style={{ background: "var(--bg-surface-alt)", color: "var(--accent)", borderColor: "var(--border-default)" }}>
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button onClick={handleSave} disabled={saving || !!jsonError} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--success)" }}>
                    <Save className="w-3 h-3" /> {saving ? "..." : "Save"}
                  </button>
                  <button onClick={handleCancel} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer" style={{ background: "var(--bg-surface-alt)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}>
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Threshold */}
          <div className="rounded-lg p-3 border mb-4" style={{ background: "var(--bg-surface-alt)", borderColor: "var(--border-subtle)" }}>
            <div className="flex justify-between text-xs mb-1">
              <span style={lb}>Approval Threshold</span>
              <span className="font-mono font-medium" style={hd}>{editing ? editThreshold.toFixed(2) : (policy?.threshold?.toFixed(2) ?? "0.65")}</span>
            </div>
            {editing && <input type="range" min={0.3} max={0.9} step={0.01} value={editThreshold} onChange={e => setEditThreshold(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, var(--accent) ${((editThreshold - 0.3) / 0.6) * 100}%, var(--border-default) ${((editThreshold - 0.3) / 0.6) * 100}%)` }} />}
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 mb-3 p-0.5 rounded-lg" style={{ background: "var(--bg-surface-alt)" }}>
            {[{ key: "rules" as const, icon: Code, label: "Decision Rules", tip: "JSON array of policy rules applied during governance enforcement. Each rule defines when it triggers (e.g. DIR < 0.8 for a protected group) and what action to take (score multiplier or additive boost). Edit freely and save to apply live." }, { key: "counterfactual" as const, icon: FlaskConical, label: "Counterfactual Config", tip: "Defines how to construct a \"bias-free\" version of each applicant. For example, a Female applicant's Income is divided by 0.85 to reverse the historical pay gap penalty. These values power the CAFP correction formula." }].map(t => (
              <button key={t.key} onClick={() => setEditorTab(t.key)} className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 rounded-md transition-colors cursor-pointer"
                style={{ background: editorTab === t.key ? "var(--bg-surface)" : "transparent", color: editorTab === t.key ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: editorTab === t.key ? "var(--shadow-sm)" : "none" }}>
                <t.icon className="w-3 h-3" /> {t.label}
                {editorTab === t.key && <HelpTooltip text={t.tip} />}
              </button>
            ))}
          </div>

          {editing ? (
            <div>
              <textarea value={editorTab === "rules" ? rulesJson : cfJson} onChange={e => handleJsonChange(e.target.value, editorTab === "rules" ? "rules" : "cf")} spellCheck={false}
                className="w-full font-mono text-xs leading-relaxed p-4 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y"
                style={{ background: "var(--bg-inset, var(--bg-surface-alt))", color: "var(--text-primary)", borderColor: jsonError ? "var(--danger)" : "var(--border-default)", minHeight: "240px", tabSize: 2 }} />
              {jsonError && <div className="flex items-center gap-1.5 mt-2 text-xs font-medium" style={{ color: "var(--danger)" }}><AlertTriangle className="w-3 h-3" /> {jsonError}</div>}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
              <pre className="text-xs leading-relaxed p-4 overflow-x-auto font-mono" style={{ background: "var(--bg-surface-alt)", color: "var(--text-secondary)", maxHeight: "280px" }}>
                {editorTab === "rules" ? JSON.stringify(policy?.decision_rules ?? [], null, 2) : JSON.stringify(policy?.counterfactual_adjustments ?? {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Multi-Dimensional Fairness + Drift */}
      <div className="space-y-5">
        {/* Fairness Analysis */}
        <div className="rounded-xl border p-5" style={card}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <h3 className="text-sm font-semibold flex items-center" style={hd}>Multi-Dimensional Fairness
                <HelpTooltip text="Runs statistical hypothesis testing (two-proportion z-test) across 5 fairness dimensions: Gender, Zip Code, Age Bracket, Income Bracket, and Intersectional groups. A p-value below 0.05 combined with DIR below 0.8 signals statistically significant bias." />
              </h3>
            </div>
            {fairness && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{
              background: fairness.overall_verdict === "Fair" ? "var(--success-surface)" : "var(--danger-surface)",
              color: fairness.overall_verdict === "Fair" ? "var(--success)" : "var(--danger)"
            }}>{fairness.overall_verdict}</span>}
          </div>

          {/* Dimension Overview Pills */}
          {fairness?.dimensions && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dimNames.map(dim => {
                const d = fairness.dimensions[dim];
                const active = dim === fairnessDim;
                const flagged = d.has_significant;
                return (
                  <button key={dim} onClick={() => setFairnessDim(dim)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full cursor-pointer transition-all border"
                    style={{
                      background: active ? (flagged ? "var(--danger)" : "var(--success)") : "var(--bg-surface-alt)",
                      color: active ? "#fff" : (flagged ? "var(--danger)" : "var(--text-secondary)"),
                      borderColor: active ? "transparent" : (flagged ? "var(--danger)" : "var(--border-subtle)"),
                    }}>
                    {flagged && !active ? "⚠ " : ""}{dim}
                  </button>
                );
              })}
            </div>
          )}

          {/* Flagged Summary */}
          {fairness?.flagged_dimensions?.length > 0 && (
            <div className="rounded-lg p-2.5 mb-3 flex items-start gap-2" style={{ background: "var(--danger-surface)" }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--danger)" }} />
              <p className="text-[11px]" style={{ color: "var(--danger)" }}>
                <strong>Flagged:</strong> {fairness.flagged_dimensions.join(", ")} · Worst DIR: {fairness.worst_dir} · n={fairness.total_samples}
              </p>
            </div>
          )}

          {/* Selected Dimension Detail */}
          {currentDim?.group_metrics ? (
            <div className="space-y-2">
              {Object.entries(currentDim.group_metrics).map(([group, data]: [string, any]) => (
                <div key={group} className="rounded-lg p-2.5 border" style={{ background: "var(--bg-surface-alt)", borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={hd}>{group}</span>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{
                      background: data.verdict === "Fair" ? "var(--success-surface)" : data.verdict === "Reference Group" ? "var(--accent-surface)" : "var(--danger-surface)",
                      color: data.verdict === "Fair" ? "var(--success)" : data.verdict === "Reference Group" ? "var(--accent)" : "var(--danger)"
                    }}>{data.verdict}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div><p className="text-[9px] uppercase" style={lb}>DIR</p><p className="text-sm font-bold font-mono" style={hd}>{data.dir?.toFixed(3)}</p></div>
                    <div><p className="text-[9px] uppercase" style={lb}>Rate</p><p className="text-sm font-bold font-mono" style={hd}>{(data.rate * 100).toFixed(1)}%</p></div>
                    <div><p className="text-[9px] uppercase" style={lb}>p-value</p><p className="text-sm font-bold font-mono" style={{ color: data.p_value < 0.05 ? "var(--danger)" : "var(--success)" }}>{data.p_value < 0.001 ? "<0.001" : data.p_value?.toFixed(4)}</p></div>
                    <div><p className="text-[9px] uppercase" style={lb}>n</p><p className="text-sm font-bold font-mono" style={hd}>{data.n}</p></div>
                  </div>
                </div>
              ))}
              <p className="text-[10px]" style={lb}>Ref: {currentDim.reference_group} · Min DIR: {currentDim.min_dir}</p>
            </div>
          ) : <p className="text-xs" style={lb}>Loading...</p>}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-4" style={card}>
            <div className="flex items-center gap-2 mb-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: psiVal >= driftMetrics.psi.threshold ? "var(--danger-surface)" : "var(--warning-surface)" }}><Activity className="w-3.5 h-3.5" style={{ color: psiVal >= driftMetrics.psi.threshold ? "var(--danger)" : "var(--warning)" }} /></div>
              <span className="text-[10px] uppercase tracking-wider font-medium" style={lb}>PSI</span></div>
            <p className="text-2xl font-bold font-mono" style={{ color: psiVal >= driftMetrics.psi.threshold ? "var(--danger)" : "var(--warning)" }}>{psiVal.toFixed(3)}</p>
          </div>
          <div className="rounded-xl border p-4" style={card}>
            <div className="flex items-center gap-2 mb-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: (fairness?.worst_dir ?? 1) >= 0.8 ? "var(--success-surface)" : "var(--danger-surface)" }}><TrendingUp className="w-3.5 h-3.5" style={{ color: (fairness?.worst_dir ?? 1) >= 0.8 ? "var(--success)" : "var(--danger)" }} /></div>
              <span className="text-[10px] uppercase tracking-wider font-medium" style={lb}>Worst DIR</span></div>
            <p className="text-2xl font-bold font-mono" style={{ color: (fairness?.worst_dir ?? 1) >= 0.8 ? "var(--success)" : "var(--danger)" }}>{fairness?.worst_dir?.toFixed(3) ?? "..."}</p>
          </div>
        </div>

        {/* Drift */}
        <div className="rounded-xl border p-5" style={card}>
          <h3 className="text-sm font-semibold mb-3 flex items-center" style={hd}>Drift Monitoring
            <HelpTooltip text="Population Stability Index (PSI) measures how much the incoming applicant population has shifted from the training distribution. PSI > 0.2 signals significant drift that may degrade model accuracy and require retraining." />
          </h3>
          <button onClick={runSimulation} disabled={simulating} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer disabled:opacity-60 mb-3" style={{ background: "var(--accent)" }}>
            {simulating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</> : <><Play className="w-4 h-4" /> Run Simulation</>}
          </button>
          <div className="space-y-2">
            {driftMetrics.alertHistory.slice(0, 3).map((alert, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg border" style={{ background: "var(--bg-surface-alt)", borderColor: "var(--border-subtle)" }}>
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
                <div><span className="text-[10px] font-medium" style={hd}>{alert.type}</span> <span className="text-[10px]" style={lb}>{alert.date}</span>
                  <p className="text-[10px] mt-0.5" style={lb}>{alert.message}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
