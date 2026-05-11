"use client";

import { Icon } from "@/components/app/icon";
import { Ring } from "@/components/app/ring";

interface RecoveryData {
  hrv?: number | null;
  sleep_hours?: number | null;
  body_battery?: number | null;
}

interface TodayCardProps {
  sessionType?: string | null;
  aiNotes?: string | null;
  date?: string | null;
  readiness?: "good" | "fair" | "low" | null;
  hrv?: number | null;
  recovery?: RecoveryData | null;
}

function formatDateLabel(dateStr: string | null | undefined): string {
  if (!dateStr) {
    const now = new Date();
    return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function TodayCard({ sessionType, aiNotes, date, readiness, hrv, recovery }: TodayCardProps) {
  const resolvedHrv = hrv ?? recovery?.hrv ?? null;
  const recoveryScore = resolvedHrv != null ? Math.round(resolvedHrv) : null;
  const dateLabel = formatDateLabel(date);

  const readinessMap = { good: 0.85, fair: 0.55, low: 0.25 } as const;
  const readinessLabelMap = { good: "Good", fair: "Fair", low: "Low" } as const;
  const readinessValue = readiness ? readinessMap[readiness] : 0.5;
  const readinessLabel = readiness ? readinessLabelMap[readiness] : "—";

  let sessionLabel: string;
  let notes: string;

  if (sessionType == null) {
    sessionLabel = "No session planned";
    notes = "No training plan active. Set up your plan to get started.";
  } else if (sessionType.toLowerCase() === "rest" || sessionType.toLowerCase() === "recovery") {
    sessionLabel = "Rest Day";
    notes = aiNotes || "Take it easy — recovery day.";
  } else {
    sessionLabel = sessionType;
    notes = aiNotes || "Get after it today.";
  }

  return (
    <div
      className="card"
      style={{
        background: "linear-gradient(120deg, var(--coral) 0%, var(--coral-deep) 100%)",
        color: "var(--ink)",
        position: "relative",
        overflow: "hidden",
        padding: 32,
        marginBottom: 18,
      }}
    >
      <div
        className="blob"
        style={{
          width: 280,
          height: 280,
          background: "#fff",
          opacity: 0.18,
          top: -100,
          right: -60,
          animation: "float-1 12s ease-in-out infinite",
        }}
      />
      <div
        className="blob"
        style={{
          width: 200,
          height: 200,
          background: "var(--lemon)",
          opacity: 0.4,
          bottom: -100,
          left: 120,
          animation: "float-2 14s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "var(--ink)", opacity: 0.6 }}>
            Today · {dateLabel}
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "8px 0 4px",
              lineHeight: 1.05,
            }}
          >
            {sessionLabel}
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-2)",
              margin: "0 0 18px",
              maxWidth: 480,
            }}
          >
            {notes}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn-ghost"
              style={{ background: "rgba(255,255,255,0.5)" }}
            >
              <Icon name="chat" size={14} /> Ask coach
            </button>
            {recoveryScore != null && (
              <span
                style={{
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.55)",
                }}
              >
                <Icon name="zap" size={12} /> Recovery {recoveryScore}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center" }}>
          <Ring
            size={140}
            stroke={14}
            value={readinessValue}
            color="var(--ink)"
            track="rgba(255,255,255,0.4)"
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                }}
              >
                {readinessLabel}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-2)",
                  fontWeight: 700,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                }}
              >
                readiness
              </div>
            </div>
          </Ring>
        </div>
      </div>
    </div>
  );
}
