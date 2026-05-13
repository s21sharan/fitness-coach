"use client";

import { formatContractOutline, type WorkoutContractV1 } from "@/lib/training/workout-contract";

export type PlannedCardVariant = "future" | "today" | "past";

interface PlannedCardProps {
  variant?: PlannedCardVariant;
  sessionType: string;
  aiNotes: string | null;
  targets: {
    contract?: WorkoutContractV1 | null;
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
}

const VARIANT_STYLES: Record<
  PlannedCardVariant,
  { bg: string; border: string; text: string; sub: string; tagBg: string; tagText: string }
> = {
  future: {
    bg: "#fffbeb",
    border: "#f59e0b",
    text: "#92400e",
    sub: "#b45309",
    tagBg: "#fde68a",
    tagText: "#92400e",
  },
  today: {
    bg: "#eff6ff",
    border: "#3b82f6",
    text: "#1e3a8a",
    sub: "#1d4ed8",
    tagBg: "#bfdbfe",
    tagText: "#1e40af",
  },
  past: {
    bg: "#f5f3ff",
    border: "#8b5cf6",
    text: "#5b21b6",
    sub: "#6d28d9",
    tagBg: "#ddd6fe",
    tagText: "#5b21b6",
  },
};

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

function isContractV1(x: unknown): x is WorkoutContractV1 {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { version?: unknown }).version === 1 &&
    Array.isArray((x as { steps?: unknown }).steps)
  );
}

export function PlannedCard({ variant = "future", sessionType, aiNotes, targets }: PlannedCardProps) {
  const icon = getSessionIcon(sessionType);
  const v = VARIANT_STYLES[variant];
  const contract = targets?.contract && isContractV1(targets.contract) ? targets.contract : null;
  const outline = contract ? formatContractOutline(contract) : null;

  return (
    <div
      style={{
        borderLeft: `3px dashed ${v.border}`,
        borderRadius: 5,
        padding: "6px 8px",
        background: v.bg,
        fontSize: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <span role="img" aria-label={sessionType} style={{ fontSize: 12 }}>
          {icon}
        </span>
        <span style={{ fontWeight: 700, color: v.text, fontSize: 11 }}>{sessionType}</span>
      </div>

      {outline && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: v.sub,
            marginBottom: 4,
            lineHeight: 1.35,
          }}
        >
          {outline}
        </div>
      )}

      {targets && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 4 }}>
          {targets.target_distance_km != null && (
            <span style={{ color: v.sub }}>{targets.target_distance_km} km</span>
          )}
          {targets.target_duration_min != null && (
            <span style={{ color: v.sub }}>{targets.target_duration_min} min</span>
          )}
          {targets.target_pace_min_km != null && (
            <span style={{ color: v.sub }}>{formatPace(targets.target_pace_min_km)}</span>
          )}
          {targets.target_hr_zone != null && !outline && (
            <span style={{ color: v.sub }}>Z{targets.target_hr_zone}</span>
          )}
          {targets.target_hr_max != null && (
            <span style={{ color: v.sub }}>HR max {targets.target_hr_max}</span>
          )}
          {targets.muscle_focus != null && (
            <span style={{ color: v.sub }}>{targets.muscle_focus}</span>
          )}
        </div>
      )}

      {aiNotes && (
        <div
          style={{
            fontStyle: "italic",
            fontSize: 9,
            color: v.sub,
            opacity: 0.85,
            marginBottom: 4,
          }}
        >
          {aiNotes}
        </div>
      )}

      <div
        style={{
          display: "inline-block",
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "1px 4px",
          borderRadius: 3,
          background: v.tagBg,
          color: v.tagText,
        }}
      >
        Planned
      </div>
    </div>
  );
}
