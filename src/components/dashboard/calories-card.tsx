"use client";

import { MacroDonut } from "@/components/app/macro-donut";

interface CaloriesCardProps {
  calories?: number | null;
  target?: number | null;
  targetCalories?: number | null;
  protein?: number | null;
}

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

export function CaloriesCard({ calories, target, targetCalories, protein }: CaloriesCardProps) {
  const cal = calories ?? null;
  const prot = protein ?? null;
  // Support both `target` and `targetCalories` prop names
  const targetVal = target ?? targetCalories ?? null;

  if (cal == null) {
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
        </div>
        <div style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600, marginTop: 8 }}>
          No data today
        </div>
      </div>
    );
  }

  const calDisplay = cal.toLocaleString();
  const targetDisplay = targetVal != null ? targetVal.toLocaleString() : "--";
  const protDisplay = prot != null ? `${prot}g protein` : "--";

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
          {protDisplay}
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
        {calDisplay} / {targetDisplay}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 6,
        }}
      >
        <MacroDonut size={120} p={prot ?? 148} calories={cal} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12,
          }}
        >
          <Legend color="var(--coral-deep)" label="Protein" v={prot != null ? `${prot}g` : "--"} />
          <Legend color="var(--sky-deep)" label="Carbs" v="--" />
          <Legend color="var(--lemon-deep)" label="Fat" v="--" />
        </div>
      </div>
    </div>
  );
}
