import { useState } from "react";
import { Search, Filter, FileSearch } from "lucide-react";
import { type Applicant } from "../data/mockData";
import HelpTooltip from "./HelpTooltip";

interface ApplicantQueueProps {
  governanceActive: boolean;
  applicants: Applicant[];
  onSelectApplicant: (applicant: Applicant) => void;
}

const biasConfig = {
  Biased: { label: "Biased", color: "var(--danger)", surface: "var(--danger-surface)" },
  "Non-Biased": { label: "Non-Biased", color: "var(--success)", surface: "var(--success-surface)" },
};

const decisionConfig = {
  Approved: { label: "Approved", color: "var(--success)", surface: "var(--success-surface)" },
  "Auto-Corrected": { label: "Auto-Corrected", color: "var(--warning)", surface: "var(--warning-surface)" },
  "Needs Review": { label: "Needs Review", color: "var(--danger)", surface: "var(--danger-surface)" },
};

export default function ApplicantQueue({ governanceActive, applicants, onSelectApplicant }: ApplicantQueueProps) {
  const [biasFilter, setBiasFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = applicants.filter((a) => {
    if (biasFilter !== "all" && a.biasStatus !== biasFilter) return false;
    if (decisionFilter !== "all" && a.decisionStatus !== decisionFilter) return false;
    if (reviewFilter === "needs_review" && a.decisionStatus !== "Needs Review") return false;
    if (reviewFilter === "no_review" && a.decisionStatus === "Needs Review") return false;
    if (searchQuery && !a.id.toLowerCase().includes(searchQuery.toLowerCase()) && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    borderColor: "var(--border-default)",
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          <input
            type="text"
            placeholder="Search by ID or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          <select
            value={biasFilter}
            onChange={(e) => setBiasFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            style={inputStyle}
          >
            <option value="all">All Bias Status</option>
            <option value="Biased">Biased</option>
            <option value="Non-Biased">Non-Biased</option>
          </select>
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            style={inputStyle}
          >
            <option value="all">All Decisions</option>
            <option value="Approved">Approved</option>
            <option value="Auto-Corrected">Auto-Corrected</option>
            <option value="Needs Review">Needs Review</option>
          </select>
          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            style={inputStyle}
          >
            <option value="all">All Reviews</option>
            <option value="needs_review">Needs Review</option>
            <option value="no_review">No Review Needed</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs font-medium">
          {(() => {
            const needsReview = applicants.filter(a => a.decisionStatus === "Needs Review").length;
            return needsReview > 0 ? (
              <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--danger-surface)", color: "var(--danger)" }}>
                {needsReview} need review
              </span>
            ) : null;
          })()}
          <span style={{ color: "var(--text-tertiary)" }}>{filtered.length} of {applicants.length} applicants</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-sm)", borderColor: "var(--border-default)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-alt)" }}>
                {[
                  { label: "Applicant ID", tip: null },
                  { label: "Name", tip: null },
                  { label: "Gender", tip: null },
                  { label: "Income", tip: null },
                  { label: "Bias Status", tip: "Determined by the hybrid bias detector: counterfactual gap (score difference if historical discrimination were removed) or subgroup deviation > 15%. Biased = at least one trigger fired." },
                  { label: "Decision", tip: "Approved = score above threshold, no bias. Auto-Corrected = bias detected and CAFP correction applied. Needs Review = bias detected but correction could not fully resolve it, or governance is off." },
                  { label: "Action", tip: null },
                ].map((col) => (
                  <th key={col.label} className="text-left text-xs font-semibold uppercase tracking-wider px-5 py-3" style={{ color: "var(--text-tertiary)" }}>
                    <span className="inline-flex items-center">{col.label}{col.tip && <HelpTooltip text={col.tip} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((applicant, i) => {
                const biasCfg = biasConfig[applicant.biasStatus as keyof typeof biasConfig] || biasConfig["Non-Biased"];
                // When governance is OFF and applicant is biased, always show "Needs Review"
                const effectiveDecisionStatus = (!governanceActive && applicant.biasStatus === "Biased") ? "Needs Review" : applicant.decisionStatus;
                const decCfg = decisionConfig[effectiveDecisionStatus as keyof typeof decisionConfig] || decisionConfig["Needs Review"];
                return (
                  <tr
                    key={applicant.id}
                    className="transition-colors cursor-default"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{applicant.id}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{applicant.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{applicant.gender}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        ${applicant.income.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: biasCfg.surface, color: biasCfg.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: biasCfg.color }} />
                        {biasCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: decCfg.surface, color: decCfg.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: decCfg.color }} />
                        {decCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => onSelectApplicant(applicant)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        style={{ background: "var(--accent-surface)", color: "var(--accent)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        Audit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>
                    No applicants match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
