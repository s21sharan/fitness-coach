"use client";

import { Sparkline } from "@/components/app/sparkline";

export function RecoveryCard() {
  return (
    <div className="card" style={{ background: "var(--sky)", padding: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--ink-2)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Recovery
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-2)",
            opacity: 0.7,
          }}
        >
          HRV · 7-day
        </span>
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "-0.025em",
          marginBottom: 6,
        }}
      >
        78
      </div>
      <Sparkline
        points={[58, 62, 55, 68, 72, 75, 78]}
        width={210}
        height={56}
        color="#1d4a59"
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#1d4a59",
          marginTop: 4,
        }}
      >
        ↑ trending up · ready to push
      </div>
    </div>
  );
}
