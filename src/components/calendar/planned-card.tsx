"use client";

interface PlannedCardProps {
  sessionType: string;
  aiNotes: string | null;
  targets: {
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
}

function getSessionIcon(sessionType: string): string {
  const lower = sessionType.toLowerCase();
  if (/run|jog/.test(lower)) return "🏃";
  if (/bike|ride|cycling/.test(lower)) return "🚴";
  if (/swim|pool/.test(lower)) return "🏊";
  if (/lift|push|pull|legs|upper|lower|full.body|arms|shoulders|back|chest|strength/.test(lower))
    return "🏋️";
  if (/rest|recovery|off/.test(lower)) return "😴";
  return "🏋️";
}

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

export function PlannedCard({ sessionType, aiNotes, targets }: PlannedCardProps) {
  const icon = getSessionIcon(sessionType);

  return (
    <div
      style={{
        opacity: 0.55,
        borderLeft: "3px dashed #9ca3af",
        borderRadius: 5,
        padding: "6px 8px",
        background: "#f9fafb",
        fontSize: 10,
      }}
    >
      {/* Header: icon + session type */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <span role="img" aria-label={sessionType} style={{ fontSize: 12 }}>
          {icon}
        </span>
        <span style={{ fontWeight: 700, color: "#374151", fontSize: 11 }}>{sessionType}</span>
      </div>

      {/* Targets */}
      {targets && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
          {targets.target_distance_km != null && (
            <span style={{ color: "#6b7280" }}>{targets.target_distance_km} km</span>
          )}
          {targets.target_duration_min != null && (
            <span style={{ color: "#6b7280" }}>{targets.target_duration_min} min</span>
          )}
          {targets.target_pace_min_km != null && (
            <span style={{ color: "#6b7280" }}>{formatPace(targets.target_pace_min_km)}</span>
          )}
          {targets.target_hr_zone != null && (
            <span style={{ color: "#6b7280" }}>Z{targets.target_hr_zone}</span>
          )}
          {targets.target_hr_max != null && (
            <span style={{ color: "#6b7280" }}>HR max {targets.target_hr_max}</span>
          )}
          {targets.muscle_focus != null && (
            <span style={{ color: "#6b7280" }}>{targets.muscle_focus}</span>
          )}
        </div>
      )}

      {/* AI Notes */}
      {aiNotes && (
        <div
          style={{
            fontStyle: "italic",
            fontSize: 9,
            color: "#9ca3af",
            marginBottom: 4,
          }}
        >
          {aiNotes}
        </div>
      )}

      {/* Planned tag */}
      <div
        style={{
          display: "inline-block",
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "1px 4px",
          borderRadius: 3,
          background: "#e5e7eb",
          color: "#9ca3af",
        }}
      >
        Planned
      </div>
    </div>
  );
}
