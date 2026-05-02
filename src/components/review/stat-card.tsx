"use client";

type Tone = "coral" | "mint" | "sky" | "lemon";

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
  sub: string;
}

const TONE_BG: Record<Tone, string> = {
  coral: "var(--coral)",
  mint: "var(--mint)",
  sky: "var(--sky)",
  lemon: "var(--lemon)",
};

export function StatCard({ label, value, delta, tone, sub }: StatCardProps) {
  return (
    <div className="card" style={{ background: TONE_BG[tone], padding: 20 }}>
      <div className="eyebrow">{label}</div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          margin: "6px 0 4px",
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "var(--ink)",
          }}
        >
          {delta}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-2)",
          opacity: 0.75,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
