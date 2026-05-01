"use client";

interface ContextRowProps {
  label: string;
  value: string;
  tone: "coral" | "mint" | "sky" | "white";
  sub?: string;
}

function ContextRow({ label, value, tone, sub }: ContextRowProps) {
  const bg: Record<string, string> = {
    coral: "var(--coral-soft)",
    mint: "var(--mint-soft)",
    sky: "var(--sky-soft)",
    white: "#fff",
  };

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: bg[tone],
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-2)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{value}</span>
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const PROMPTS = [
  { emoji: "🏃", text: "Plan my week" },
  { emoji: "🥗", text: "What should I eat?" },
  { emoji: "💪", text: "Why is bench stalling?" },
  { emoji: "😴", text: "Am I overtraining?" },
];

interface ContextPanelProps {
  onPromptSelect?: (prompt: string) => void;
}

export function ContextPanel({ onPromptSelect }: ContextPanelProps) {
  return (
    <div
      style={{
        width: 280,
        borderLeft: "1px solid var(--line)",
        padding: "24px 22px",
        overflow: "auto",
        background: "rgba(255,255,255,0.4)",
        flexShrink: 0,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Live context
      </div>
      <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
        <ContextRow label="HRV" value="38" tone="coral" sub="↓ 18 from baseline" />
        <ContextRow label="Sleep" value="5h 40m" tone="coral" sub="poor" />
        <ContextRow label="Calories" value="1,498" tone="white" sub="1,902 left" />
        <ContextRow label="Protein" value="68g" tone="white" sub="82g left" />
        <ContextRow label="Sets this wk" value="22 / 28" tone="white" />
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Try asking
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {PROMPTS.map((p) => (
          <div
            key={p.text}
            onClick={() => onPromptSelect?.(p.text)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span>{p.emoji}</span>
            {p.text}
          </div>
        ))}
      </div>
    </div>
  );
}
