// Server-side mirror of src/lib/training/compliance.ts::isCardioPlanned plus
// extraction of the cardio sport. The server can't import from src/, so the
// logic is duplicated here. Kept tiny and stable on purpose.

interface PlannedTargets {
  contract?: { sport?: string | null } | null;
}

export type PlannedCategory =
  | { kind: "strength" }
  | { kind: "cardio"; sport: "run" | "bike" | "swim" }
  | { kind: "rest" }
  | { kind: "other" };

export function classifyPlanned(p: {
  session_type: string;
  targets?: PlannedTargets | null;
}): PlannedCategory {
  const session = (p.session_type ?? "").trim();
  if (/^rest$/i.test(session)) return { kind: "rest" };

  const sport = p.targets?.contract?.sport;
  if (sport === "run" || sport === "bike" || sport === "swim") {
    return { kind: "cardio", sport };
  }
  if (sport === "strength" || sport === "lift") return { kind: "strength" };

  // Fallback: regex on session_type for legacy rows without a contract.
  const lower = session.toLowerCase();
  if (/swim|pool|css/.test(lower)) return { kind: "cardio", sport: "swim" };
  if (/bike|ride|cycle|spin|zwift|trainer/.test(lower)) return { kind: "cardio", sport: "bike" };
  if (/run|jog|tempo|threshold|marathon|mile|track|zone\s*2/.test(lower)) {
    return { kind: "cardio", sport: "run" };
  }
  if (/lift|push|pull|leg|upper|lower|strength|squat|dead|bench|full body/.test(lower)) {
    return { kind: "strength" };
  }
  return { kind: "other" };
}
