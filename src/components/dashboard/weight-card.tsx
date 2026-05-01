"use client";

import { Sparkline } from "@/components/app/sparkline";

export function WeightCard() {
  return (
    <div className="card" style={{ background: "var(--mint)", padding: 22 }}>
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
          Weight
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-2)",
            opacity: 0.7,
          }}
        >
          lb · 7d
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
        183.2
      </div>
      <Sparkline
        points={[185.1, 184.8, 184.5, 184.2, 184.0, 183.6, 183.2]}
        width={210}
        height={56}
        color="#2E6B33"
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#2E6B33",
          marginTop: 4,
        }}
      >
        ↓ 1.9 lb · on track for cut
      </div>
    </div>
  );
}
