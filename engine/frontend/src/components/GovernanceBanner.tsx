import { Shield, ShieldAlert } from "lucide-react";

interface GovernanceBannerProps {
  isActive: boolean;
  onToggle: () => void;
}

export default function GovernanceBanner({ isActive, onToggle }: GovernanceBannerProps) {
  return (
    <div
      className="transition-all duration-500 rounded-xl px-5 py-3.5 flex items-center justify-between border"
      style={{
        background: isActive ? "var(--success-surface)" : "var(--danger-surface)",
        borderColor: isActive
          ? "color-mix(in srgb, var(--success) 25%, transparent)"
          : "color-mix(in srgb, var(--danger) 25%, transparent)",
      }}
    >
      <div className="flex items-center gap-3">
        {isActive ? (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)" }}
          >
            <Shield className="w-5 h-5" style={{ color: "var(--success)" }} />
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)" }}
          >
            <ShieldAlert className="w-5 h-5" style={{ color: "var(--danger)" }} />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {isActive ? "Active Bias Correction" : "Exposing Raw ML Outputs"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {isActive
              ? "Governance layer is intercepting and correcting biased decisions in real-time."
              : "⚠️ Governance disabled — raw model outputs may contain protected-class bias."}
          </p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2.5 cursor-pointer"
        aria-label="Toggle governance mode"
      >
        <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--text-secondary)" }}>
          Governance Mode
        </span>
        <div
          className="relative w-12 h-6 rounded-full transition-colors duration-300"
          style={{ background: isActive ? "var(--success)" : "var(--danger)" }}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
              isActive ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>
    </div>
  );
}
