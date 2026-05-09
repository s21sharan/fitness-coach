"use client";

import { Sparkline } from "@/components/app/sparkline";

interface RecoveryCardProps {
  hrv?: number | null;
  sleepHours?: number | null;
  bodyBattery?: number | null;
  readiness?: "good" | "fair" | "low" | null;
}

function readinessLabel(readiness: string | null | undefined): string {
  if (readiness === "good") return "Good";
  if (readiness === "fair") return "Fair";
  if (readiness === "low") return "Low";
  return "No data today";
}

function readinessTrend(readiness: string | null | undefined): string {
  if (readiness === "good") return "↑ trending up · ready to push";
  if (readiness === "fair") return "→ moderate · train at tempo";
  if (readiness === "low") return "↓ low · prioritise recovery";
  return "";
}

export function RecoveryCard({ hrv, sleepHours, bodyBattery, readiness }: RecoveryCardProps) {
  const hasData = hrv != null || sleepHours != null || bodyBattery != null;

  if (!hasData) {
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
        <div style={{ fontSize: 15, color: "var(--muted)", fontWeight: 600, marginTop: 8 }}>
          No data today
        </div>
      </div>
    );
  }

  const hrvDisplay = hrv != null ? String(Math.round(hrv)) : "--";
  const sleepDisplay = sleepHours != null ? `${sleepHours.toFixed(1)}h sleep` : bodyBattery != null ? `${bodyBattery} battery` : "HRV · 7-day";

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
          {sleepDisplay}
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
        {hrvDisplay}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1d4a59",
          marginBottom: 6,
        }}
      >
        {readinessLabel(readiness)}
      </div>
      <Sparkline
        points={[58, 62, 55, 68, 72, 75, hrv ?? 78]}
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
        {readinessTrend(readiness)}
      </div>
    </div>
  );
}
