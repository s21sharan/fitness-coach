"use client";

type ComplianceStatus = "match" | "different" | "missed" | null;

const CARDIO_RE = /run|jog|bike|ride|cycling|swim|pool/i;
const LIFTING_RE = /push|pull|legs|upper|lower|full.body|arms|shoulders|back|chest/i;
const REST_RE = /rest|recovery|off/i;

export function getComplianceStatus(
  plannedSessionType: string | null,
  workouts: { name?: string }[],
  cardio: { type?: string }[]
): ComplianceStatus {
  if (!plannedSessionType) return null;

  // Rest day always matches
  if (REST_RE.test(plannedSessionType)) return "match";

  const hasWorkouts = workouts.length > 0;
  const hasCardio = cardio.length > 0;
  const hasAnyActivity = hasWorkouts || hasCardio;

  // Planned cardio
  if (CARDIO_RE.test(plannedSessionType)) {
    const matchingCardio = cardio.some(
      (c) => c.type && CARDIO_RE.test(c.type)
    );
    if (matchingCardio) return "match";
    if (hasAnyActivity) return "different";
    return "missed";
  }

  // Planned lifting
  if (LIFTING_RE.test(plannedSessionType)) {
    if (hasWorkouts) return "match";
    if (hasCardio) return "different";
    return "missed";
  }

  // Fallback
  return hasAnyActivity ? "match" : "missed";
}

interface ComplianceBadgeProps {
  status: ComplianceStatus;
}

const STATUS_COLOR: Record<NonNullable<ComplianceStatus>, string> = {
  match: "#22c55e",
  different: "#f97316",
  missed: "#ef4444",
};

const STATUS_LABEL: Record<NonNullable<ComplianceStatus>, string> = {
  match: "Completed as planned",
  different: "Completed differently than planned",
  missed: "Missed",
};

export function ComplianceBadge({ status }: ComplianceBadgeProps) {
  if (!status) return null;

  return (
    <span
      title={STATUS_LABEL[status]}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: STATUS_COLOR[status],
      }}
    />
  );
}
