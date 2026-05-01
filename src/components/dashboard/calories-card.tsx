"use client";

import { MacroDonut } from "@/components/app/macro-donut";

function Legend({
  color,
  label,
  v,
}: {
  color: string;
  label: string;
  v: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{ width: 10, height: 10, borderRadius: 3, background: color }}
      />
      <span style={{ fontWeight: 700, fontSize: 12, minWidth: 54 }}>{label}</span>
      <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
        {v}
      </span>
    </div>
  );
}

export function CaloriesCard() {
  return (
    <div className="card" style={{ background: "#fff", padding: 22 }}>
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
          Macros
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ink-2)",
            opacity: 0.7,
          }}
        >
          148g P · 210g C · 62g F
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
        2,140 / 2,400
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 6,
        }}
      >
        <MacroDonut size={120} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12,
          }}
        >
          <Legend color="var(--coral-deep)" label="Protein" v="148g" />
          <Legend color="var(--sky-deep)" label="Carbs" v="210g" />
          <Legend color="var(--lemon-deep)" label="Fat" v="62g" />
        </div>
      </div>
    </div>
  );
}
