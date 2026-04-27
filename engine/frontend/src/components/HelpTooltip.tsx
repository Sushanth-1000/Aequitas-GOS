import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
}

export default function HelpTooltip({ text }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<"top" | "bottom">("top");
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 160 ? "bottom" : "top");
    }
  }, [visible]);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        ref={ref}
        type="button"
        aria-label="Help"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible(v => !v)}
        className="rounded-full flex items-center justify-center cursor-pointer transition-colors"
        style={{ color: "var(--text-tertiary)", outline: "none", background: "none", border: "none", padding: 0 }}
      >
        <HelpCircle className="w-3.5 h-3.5 hover:opacity-80" />
      </button>

      {visible && (
        <div
          role="tooltip"
          className="absolute z-50 w-64 rounded-xl border p-3 text-xs leading-relaxed shadow-xl"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
            boxShadow: "var(--shadow-md)",
            left: "50%",
            transform: "translateX(-50%)",
            ...(pos === "top"
              ? { bottom: "calc(100% + 8px)" }
              : { top: "calc(100% + 8px)" }),
          }}
        >
          {/* Arrow */}
          <span
            className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
              ...(pos === "top"
                ? { bottom: "-5px", borderTop: "none", borderLeft: "none" }
                : { top: "-5px", borderBottom: "none", borderRight: "none" }),
            }}
          />
          {text}
        </div>
      )}
    </span>
  );
}
