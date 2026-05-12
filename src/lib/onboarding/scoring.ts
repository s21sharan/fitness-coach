// ============================================================
// Derived coaching scores
//
// Pure functions over an AthleteContextProfile. Each returns a
// categorical bucket suitable for persistence + display.
// See section 20 of the design spec.
// ============================================================

import type {
  AthleteContextProfile,
  SportEntry,
  SportId,
} from "./types";

export type RiskBucket = "low" | "moderate" | "high" | "very_high";
export type MaturityBucket =
  | "beginner"
  | "novice"
  | "intermediate"
  | "advanced"
  | "competitive";
export type CapacityBucket = "low" | "moderate" | "high";
export type ConflictBucket = "none" | "mild" | "moderate" | "severe";
export type FlexibilityBucket = "rigid" | "moderate" | "flexible";
export type InterferenceBucket = "low" | "moderate" | "high";

export interface DerivedScores {
  training_maturity: MaturityBucket;
  ramp_risk: RiskBucket;
  recovery_capacity: CapacityBucket;
  goal_conflict: ConflictBucket;
  plan_flexibility: FlexibilityBucket;
  interference_score: InterferenceBucket;
}

// ------------------------------------------------------------
// Training maturity
// ------------------------------------------------------------

export function computeTrainingMaturity(p: AthleteContextProfile): MaturityBucket {
  const exp = p.basic.training_experience;
  const longestRun = p.sports.run.current_volume?.longest_session ?? 0;
  const longestRide = p.sports.bike.current_volume?.longest_session ?? 0;
  const liftYears = exp === "advanced" ? 3 : exp === "intermediate" ? 1 : 0;

  if (exp === "advanced" && (longestRun >= 13 || longestRide >= 3)) return "advanced";
  if (p.athlete_identity === "performance_racer") return "competitive";
  if (exp === "advanced") return "advanced";
  if (exp === "intermediate" || liftYears >= 1) return "intermediate";
  if (longestRun >= 6 || longestRide >= 1) return "novice";
  return "beginner";
}

// ------------------------------------------------------------
// Ramp risk
// ------------------------------------------------------------

export function computeRampRisk(p: AthleteContextProfile): RiskBucket {
  let score = 0;

  for (const sport of (["run", "bike", "swim"] as SportId[])) {
    const s = p.sports[sport];
    if (!s.is_planned) continue;
    const current = primaryVolume(s);
    const target = primaryTarget(s);
    if (current && target && current > 0) {
      const ratio = target / current;
      if (ratio >= 3) score += 3;
      else if (ratio >= 2) score += 2;
      else if (ratio >= 1.5) score += 1;
    }
  }

  if (p.injuries.length > 0) score += 1;
  if (p.injuries.some((i) => i.current_pain_level >= 4)) score += 2;

  if (p.recovery.avg_sleep_hours !== null && p.recovery.avg_sleep_hours < 6.5) score += 1;
  if (p.aggressiveness === "push_hard") score += 1;
  if (p.aggressiveness === "conservative") score -= 1;

  if (p.events.some((e) => e.priority === "A" && e.event_date)) {
    const soonest = soonestEventWeeks(p);
    if (soonest !== null && soonest < 10) score += 1;
    if (soonest !== null && soonest < 6) score += 1;
  }

  if (p.sports.lift.is_planned && (p.sports.lift.current_volume?.weekly_sessions ?? 0) >= 5) {
    score += 1;
  }

  if (score >= 6) return "very_high";
  if (score >= 4) return "high";
  if (score >= 2) return "moderate";
  return "low";
}

// ------------------------------------------------------------
// Recovery capacity
// ------------------------------------------------------------

export function computeRecoveryCapacity(p: AthleteContextProfile): CapacityBucket {
  let score = 0;

  const sleep = p.recovery.avg_sleep_hours;
  if (sleep !== null) {
    if (sleep >= 7.5) score += 2;
    else if (sleep >= 6.5) score += 1;
    else score -= 1;
  }

  if (p.recovery.sleep_consistency === "very_consistent") score += 1;
  if (p.recovery.sleep_consistency === "poor") score -= 1;

  if (p.recovery.work_stress === "low") score += 1;
  if (p.recovery.work_stress === "very_high") score -= 2;
  if (p.recovery.work_stress === "high") score -= 1;

  if (p.recovery.physical_job) score -= 1;

  if (p.recovery.recovery_confidence === "fresh" || p.recovery.recovery_confidence === "under_training") score += 1;
  if (p.recovery.recovery_confidence === "always_cooked") score -= 2;
  if (p.recovery.recovery_confidence === "slightly_under") score -= 1;

  if (p.recovery.has_readiness_data) score += 1;

  if (score >= 3) return "high";
  if (score >= 0) return "moderate";
  return "low";
}

// ------------------------------------------------------------
// Goal conflict
// ------------------------------------------------------------

export function computeGoalConflict(p: AthleteContextProfile): ConflictBucket {
  const goals = new Set(p.goal_keys);
  const body = p.body_nutrition.body_goal;
  let conflicts = 0;

  const wantsBulk = body === "aggressive_bulk" || body === "lean_bulk";
  const wantsCut = body === "cut_fat" || body === "slow_cut" || body === "race_weight_focused";
  const wantsRace = goals.has("first_long_event") || goals.has("run_faster") || goals.has("improve_triathlon") || p.events.some((e) => e.priority === "A");
  const wantsMuscle = goals.has("build_muscle");
  const wantsStrength = goals.has("get_stronger");

  if (wantsBulk && wantsRace) conflicts += 2;
  if (body === "aggressive_bulk" && wantsRace) conflicts += 1;
  if (wantsCut && (goals.has("build_muscle") || goals.has("get_stronger"))) conflicts += 1;
  if (body === "cut_fat" && wantsRace) conflicts += 2;
  if (wantsStrength && wantsRace && p.sports.lift.is_planned && (p.sports.lift.target_peak?.weekly_sessions ?? 0) >= 5) {
    conflicts += 1;
  }
  if (wantsMuscle && goals.has("lose_fat")) conflicts += 1;

  if (p.injuries.length > 0 && computeRampRisk(p) === "very_high") conflicts += 1;

  if (conflicts >= 4) return "severe";
  if (conflicts >= 2) return "moderate";
  if (conflicts >= 1) return "mild";
  return "none";
}

// ------------------------------------------------------------
// Plan flexibility
// ------------------------------------------------------------

export function computePlanFlexibility(p: AthleteContextProfile): FlexibilityBucket {
  if (p.coach.plan_flexibility === "very_flexible") return "flexible";
  if (p.coach.plan_flexibility === "somewhat_flexible") return "moderate";
  if (p.coach.plan_flexibility === "highly_structured") return "rigid";
  if (p.coach.plan_flexibility === "structured") return "moderate";

  const windowCount = p.availability_windows.length;
  if (windowCount >= 10) return "flexible";
  if (windowCount >= 5) return "moderate";
  return "rigid";
}

// ------------------------------------------------------------
// Strength / endurance interference
// ------------------------------------------------------------

export function computeInterferenceScore(p: AthleteContextProfile): InterferenceBucket {
  if (!p.sports.lift.is_planned) return "low";
  const liftSessions = p.sports.lift.target_peak?.weekly_sessions ?? p.sports.lift.current_volume?.weekly_sessions ?? 0;
  const tolerance = p.sports.lift.sport_specific?.leg_interference;

  let score = 0;
  if (liftSessions >= 5) score += 2;
  else if (liftSessions >= 4) score += 1;

  const cardioHeavy =
    (p.sports.run.is_planned && (p.sports.run.target_peak?.weekly_miles ?? 0) >= 40) ||
    (p.sports.bike.is_planned && (p.sports.bike.target_peak?.weekly_hours ?? 0) >= 8);
  if (cardioHeavy) score += 2;

  if (tolerance === "heavy_legs_fine" || tolerance === "sacrifice_run_for_strength") score -= 1;
  if (tolerance === "heavy_legs_interfere" || tolerance === "minimal_lower_soreness") score += 1;

  if (score >= 3) return "high";
  if (score >= 1) return "moderate";
  return "low";
}

// ------------------------------------------------------------
// Aggregate
// ------------------------------------------------------------

export function computeAllScores(p: AthleteContextProfile): DerivedScores {
  return {
    training_maturity: computeTrainingMaturity(p),
    ramp_risk: computeRampRisk(p),
    recovery_capacity: computeRecoveryCapacity(p),
    goal_conflict: computeGoalConflict(p),
    plan_flexibility: computePlanFlexibility(p),
    interference_score: computeInterferenceScore(p),
  };
}

// ------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------

function primaryVolume(s: SportEntry): number | null {
  const v = s.current_volume;
  if (!v) return null;
  return (
    v.weekly_miles ??
    v.weekly_hours ??
    v.weekly_meters ??
    v.weekly_sessions ??
    null
  );
}

function primaryTarget(s: SportEntry): number | null {
  const t = s.target_peak;
  if (!t) return null;
  return (
    t.weekly_miles ??
    t.weekly_hours ??
    t.weekly_meters ??
    t.weekly_sessions ??
    null
  );
}

function soonestEventWeeks(p: AthleteContextProfile): number | null {
  const dated = p.events.filter((e) => e.event_date);
  if (dated.length === 0) return null;
  const now = Date.now();
  const minDelta = Math.min(
    ...dated.map((e) => new Date(e.event_date!).getTime() - now)
  );
  return Math.max(0, Math.round(minDelta / (7 * 24 * 60 * 60 * 1000)));
}
