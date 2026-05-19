import type { PlannedWorkoutTargets } from "@/lib/training/workout-contract";

export interface ComplianceInput {
  planned: Array<{
    date: string;
    session_type: string;
    is_cardio: boolean;
    // Authoritative status written by the sync matcher or by the user. When
    // present, takes precedence over date-based matching.
    status?: string | null;
    skip_reason?: string | null;
  }>;
  actualLifting: Array<{ date: string; name: string }>;
  actualCardio: Array<{ date: string; type: string; distance: number }>;
}

/**
 * Decide if a planned row represents cardio. Reads `targets.contract.sport` when
 * present; falls back to a regex on session_type for legacy rows without a contract.
 */
export function isCardioPlanned(p: {
  session_type: string;
  targets?: PlannedWorkoutTargets | null;
}): boolean {
  const sport = p.targets?.contract?.sport;
  if (sport) return sport === "run" || sport === "bike" || sport === "swim";
  return /run|ride|bike|swim|cardio|zone\s*2/i.test(p.session_type);
}

export interface ComplianceStats {
  totalPlanned: number;
  totalCompleted: number;
  completionRate: number;
  liftCompliance: { planned: number; completed: number };
  cardioCompliance: { planned: number; completed: number };
  skippedSessions: string[];
  extraSessions: string[];
}

function isRest(sessionType: string): boolean {
  return /^rest$/i.test(sessionType.trim());
}

// Treat the row's stored status as authoritative when it's already been
// resolved by the matcher or the user. Only legacy 'scheduled' rows (matcher
// hasn't run on them yet, or no actual ever synced) fall through to date-
// based fuzzy matching.
function isCompletedAuthoritative(status: string | null | undefined): boolean {
  return status === "completed";
}
function isSkippedAuthoritative(status: string | null | undefined): boolean {
  return status === "skipped";
}

export function computeComplianceStats(input: ComplianceInput): ComplianceStats {
  const { planned, actualLifting, actualCardio } = input;

  const activePlanned = planned.filter((p) => !isRest(p.session_type));

  const liftPlanned = activePlanned.filter((p) => !p.is_cardio);
  const cardioPlanned = activePlanned.filter((p) => p.is_cardio);

  const liftDates = new Set(actualLifting.map((a) => a.date));
  const cardioDates = new Set(actualCardio.map((a) => a.date));

  const wasCompleted = (p: ComplianceInput["planned"][number]): boolean => {
    if (isCompletedAuthoritative(p.status)) return true;
    if (isSkippedAuthoritative(p.status)) return false;
    return p.is_cardio ? cardioDates.has(p.date) : liftDates.has(p.date);
  };

  const liftCompleted = liftPlanned.filter(wasCompleted).length;
  const cardioCompleted = cardioPlanned.filter(wasCompleted).length;
  const totalCompleted = liftCompleted + cardioCompleted;

  const plannedDates = new Set(activePlanned.map((p) => p.date));

  const skippedSessions = activePlanned
    .filter((p) => !wasCompleted(p))
    .map((p) => {
      const reason = isSkippedAuthoritative(p.status) && p.skip_reason
        ? ` (${p.skip_reason.slice(0, 200)})`
        : "";
      return `${p.date}: ${p.session_type}${reason}`;
    });

  const extraSessions: string[] = [];
  for (const a of actualLifting) {
    if (!plannedDates.has(a.date)) {
      extraSessions.push(`${a.date}: ${a.name} (lifting)`);
    }
  }
  for (const a of actualCardio) {
    if (!plannedDates.has(a.date)) {
      extraSessions.push(`${a.date}: ${a.type} (cardio)`);
    }
  }

  return {
    totalPlanned: activePlanned.length,
    totalCompleted,
    completionRate: activePlanned.length > 0 ? totalCompleted / activePlanned.length : 0,
    liftCompliance: { planned: liftPlanned.length, completed: liftCompleted },
    cardioCompliance: { planned: cardioPlanned.length, completed: cardioCompleted },
    skippedSessions,
    extraSessions,
  };
}

export function formatComplianceForPrompt(stats: ComplianceStats): string {
  if (stats.totalPlanned === 0) return "";

  const lines: string[] = [];
  const pct = Math.round(stats.completionRate * 100);
  lines.push(`Plan adherence (last 2 weeks): ${pct}% (${stats.totalCompleted}/${stats.totalPlanned} sessions)`);
  lines.push(`  Lifting: ${stats.liftCompliance.completed}/${stats.liftCompliance.planned}`);
  lines.push(`  Cardio: ${stats.cardioCompliance.completed}/${stats.cardioCompliance.planned}`);

  if (stats.skippedSessions.length > 0) {
    lines.push(`Skipped sessions:`);
    for (const s of stats.skippedSessions.slice(0, 5)) {
      lines.push(`  - ${s}`);
    }
  }

  if (stats.extraSessions.length > 0) {
    lines.push(`Extra sessions (not in plan):`);
    for (const s of stats.extraSessions.slice(0, 5)) {
      lines.push(`  + ${s}`);
    }
  }

  return lines.join("\n");
}
