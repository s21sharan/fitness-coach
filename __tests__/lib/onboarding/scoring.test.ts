import { describe, it, expect } from "vitest";
import {
  computeAllScores,
  computeTrainingMaturity,
  computeRampRisk,
  computeRecoveryCapacity,
  computeGoalConflict,
  computeInterferenceScore,
  computePlanFlexibility,
} from "@/lib/onboarding/scoring";
import {
  type AthleteContextProfile,
  type SportId,
  getDefaultAthleteProfile,
} from "@/lib/onboarding/types";

function withSport(
  p: AthleteContextProfile,
  sport: SportId,
  patch: Partial<AthleteContextProfile["sports"][SportId]>
): AthleteContextProfile {
  return {
    ...p,
    sports: { ...p.sports, [sport]: { ...p.sports[sport], ...patch, is_planned: true, enabled: true } },
  };
}

describe("computeTrainingMaturity", () => {
  it("returns beginner when nothing is set", () => {
    expect(computeTrainingMaturity(getDefaultAthleteProfile())).toBe("beginner");
  });

  it("returns advanced for advanced experience with long runs", () => {
    const p = withSport(getDefaultAthleteProfile(), "run", {
      current_volume: { longest_session: 18 },
    });
    p.basic.training_experience = "advanced";
    expect(computeTrainingMaturity(p)).toBe("advanced");
  });

  it("returns competitive for performance racer identity", () => {
    const p = { ...getDefaultAthleteProfile(), athlete_identity: "performance_racer" as const };
    expect(computeTrainingMaturity(p)).toBe("competitive");
  });
});

describe("computeRampRisk", () => {
  it("is low for default profile", () => {
    expect(computeRampRisk(getDefaultAthleteProfile())).toBe("low");
  });

  it("escalates when target volume is 3x current", () => {
    const p = withSport(getDefaultAthleteProfile(), "run", {
      current_volume: { weekly_miles: 10 },
      target_peak: { weekly_miles: 30 },
    });
    expect(["moderate", "high", "very_high"]).toContain(computeRampRisk(p));
  });

  it("is very_high when multiple stressors stack", () => {
    let p = withSport(getDefaultAthleteProfile(), "run", {
      current_volume: { weekly_miles: 10 },
      target_peak: { weekly_miles: 35 },
    });
    p = withSport(p, "bike", {
      current_volume: { weekly_hours: 3 },
      target_peak: { weekly_hours: 9 },
    });
    p.injuries = [
      { id: "i1", area: "knee", current_pain_level: 5, history: false, triggers: [], affecting_training: true },
    ];
    p.aggressiveness = "push_hard";
    expect(["high", "very_high"]).toContain(computeRampRisk(p));
  });

  it("increases with injuries that have current pain", () => {
    let p = getDefaultAthleteProfile();
    p = withSport(p, "run", {
      current_volume: { weekly_miles: 20 },
      target_peak: { weekly_miles: 25 },
    });
    p.injuries = [
      { id: "i1", area: "knee", current_pain_level: 6, history: true, triggers: [], affecting_training: true },
    ];
    expect(["moderate", "high", "very_high"]).toContain(computeRampRisk(p));
  });
});

describe("computeRecoveryCapacity", () => {
  it("is high with great sleep and low stress", () => {
    const p = getDefaultAthleteProfile();
    p.recovery = {
      ...p.recovery,
      avg_sleep_hours: 8,
      sleep_consistency: "very_consistent",
      work_stress: "low",
      recovery_confidence: "fresh",
      has_readiness_data: true,
    };
    expect(computeRecoveryCapacity(p)).toBe("high");
  });

  it("is low with high stress and poor sleep", () => {
    const p = getDefaultAthleteProfile();
    p.recovery = {
      ...p.recovery,
      avg_sleep_hours: 5.5,
      sleep_consistency: "poor",
      work_stress: "very_high",
      physical_job: true,
      recovery_confidence: "always_cooked",
    };
    expect(computeRecoveryCapacity(p)).toBe("low");
  });
});

describe("computeGoalConflict", () => {
  it("flags bulk + race as conflict", () => {
    const p = getDefaultAthleteProfile();
    p.body_nutrition.body_goal = "aggressive_bulk";
    p.goal_keys = ["run_faster", "first_long_event"];
    expect(["moderate", "severe"]).toContain(computeGoalConflict(p));
  });

  it("flags cut + race performance as conflict", () => {
    const p = getDefaultAthleteProfile();
    p.body_nutrition.body_goal = "cut_fat";
    p.events = [
      {
        id: "e1",
        name: "Marathon",
        sport_type: "running",
        distance: "marathon",
        event_date: null,
        priority: "A",
        goal_type: "time",
        goal_time: null,
        course_notes: null,
        travel: false,
      },
    ];
    p.goal_keys = ["run_faster"];
    expect(["mild", "moderate", "severe"]).toContain(computeGoalConflict(p));
  });

  it("is none when only one clear goal", () => {
    const p = getDefaultAthleteProfile();
    p.goal_keys = ["build_aerobic_base"];
    expect(computeGoalConflict(p)).toBe("none");
  });
});

describe("computeInterferenceScore", () => {
  it("returns low if lifting not planned", () => {
    expect(computeInterferenceScore(getDefaultAthleteProfile())).toBe("low");
  });

  it("returns high with heavy lifting and heavy cardio", () => {
    let p = withSport(getDefaultAthleteProfile(), "lift", {
      target_peak: { weekly_sessions: 5 },
      sport_specific: { leg_interference: "heavy_legs_interfere" },
    });
    p = withSport(p, "run", { target_peak: { weekly_miles: 45 } });
    expect(computeInterferenceScore(p)).toBe("high");
  });
});

describe("computePlanFlexibility", () => {
  it("maps coach setting to bucket", () => {
    const p = getDefaultAthleteProfile();
    p.coach.plan_flexibility = "very_flexible";
    expect(computePlanFlexibility(p)).toBe("flexible");
    p.coach.plan_flexibility = "highly_structured";
    expect(computePlanFlexibility(p)).toBe("rigid");
  });
});

describe("computeAllScores", () => {
  it("returns all six buckets", () => {
    const scores = computeAllScores(getDefaultAthleteProfile());
    expect(Object.keys(scores).sort()).toEqual(
      [
        "goal_conflict",
        "interference_score",
        "plan_flexibility",
        "ramp_risk",
        "recovery_capacity",
        "training_maturity",
      ].sort()
    );
  });
});
