import { useState } from "react";
import { Users, FileSearch, BarChart3, Sun, Moon } from "lucide-react";
import { useTheme } from "./hooks/useTheme";
import GovernanceBanner from "./components/GovernanceBanner";
import ApplicantQueue from "./components/ApplicantQueue";
import AuditOverride from "./components/AuditOverride";
import SystemMetrics from "./components/SystemMetrics";
import { type Applicant } from "./data/mockData";
import { apiUrl } from "./api/client";
import { useEffect } from "react";

type TabId = "queue" | "audit" | "metrics";

const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "queue", label: "Applicant Queue", icon: Users },
  { id: "audit", label: "Audit & Override", icon: FileSearch },
  { id: "metrics", label: "System Metrics & MLOps", icon: BarChart3 },
];

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [governanceActive, setGovernanceActive] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("queue");
  const [liveApplicants, setLiveApplicants] = useState<Applicant[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/applicants"))
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = body && typeof body === "object" && "detail" in body ? String((body as { detail: unknown }).detail) : `HTTP ${res.status}`;
          throw new Error(detail);
        }
        return body;
      })
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error("Applicants API returned invalid payload.");
        }
        setLoadError(null);
        setLiveApplicants(data as Applicant[]);
        if (data.length > 0) {
          setSelectedApplicant(data[0] as Applicant);
        }
      })
      .catch(err => {
        console.error("Failed to fetch applicants:", err);
        setLiveApplicants([]);
        setSelectedApplicant(null);
        setLoadError(err instanceof Error ? err.message : "Failed to load applicants.");
      });
  }, []);

  const handleSelectApplicant = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    setActiveTab("audit");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
      {/* Top Navigation */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          background: theme === "dark" ? "rgba(26,28,40,0.85)" : "rgba(255,255,255,0.85)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏛️</span>
            <h1 className="text-sm sm:text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Aequitas-Gov
            </h1>
            <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: "var(--text-tertiary)", background: "var(--bg-surface-alt)" }}>
              Fairness Layer
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="relative w-16 h-8 rounded-full p-0.5 transition-colors duration-500 cursor-pointer border"
              style={{
                background: theme === "dark" ? "var(--bg-inset)" : "var(--bg-surface-alt)",
                borderColor: "var(--border-default)",
              }}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <div
                className="absolute top-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm"
                style={{
                  transform: theme === "dark" ? "translateX(32px)" : "translateX(0px)",
                  background: theme === "dark" ? "#2d3555" : "#fef3c7",
                }}
              >
                {theme === "dark" ? (
                  <Moon className="w-3.5 h-3.5" style={{ color: "#93a8ef" }} />
                ) : (
                  <Sun className="w-3.5 h-3.5" style={{ color: "#d97706" }} />
                )}
              </div>
            </button>

            {/* Status pill */}
            <div
              className="hidden md:flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{
                background: governanceActive ? "var(--success-surface)" : "var(--danger-surface)",
                color: governanceActive ? "var(--success)" : "var(--danger)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: governanceActive ? "var(--success)" : "var(--danger)" }} />
              {governanceActive ? "Protected" : "Unprotected"}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {loadError && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--danger-surface)", borderColor: "var(--danger)", color: "var(--danger)" }}>
            Failed to load applicants: {loadError}
          </div>
        )}
        {/* Governance Banner */}
        <GovernanceBanner isActive={governanceActive} onToggle={() => setGovernanceActive((p) => !p)} />

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-surface-alt)" }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: isActive ? "var(--bg-surface)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                  boxShadow: isActive ? "var(--shadow-sm)" : "none",
                }}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "queue" && (
          <ApplicantQueue governanceActive={governanceActive} onSelectApplicant={handleSelectApplicant} applicants={liveApplicants} />
        )}
        {activeTab === "audit" && selectedApplicant && (
          <div className="space-y-4">
            {/* Applicant selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Reviewing:
              </label>
              <select
                value={selectedApplicant.id}
                onChange={(e) => {
                  const found = liveApplicants.find((a) => a.id === e.target.value);
                  if (found) setSelectedApplicant(found);
                }}
                className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer font-mono"
                style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border-default)" }}
              >
                {liveApplicants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <AuditOverride applicant={selectedApplicant} governanceActive={governanceActive} />
          </div>
        )}
        {activeTab === "metrics" && <SystemMetrics governanceActive={governanceActive} />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8" style={{ borderColor: "var(--border-default)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            © 2026 Aequitas-Gov — AI Governance & Fairness Platform
          </p>
          <p className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            Engine v3.2.1 · Policy v2.4.1
          </p>
        </div>
      </footer>
    </div>
  );
}
