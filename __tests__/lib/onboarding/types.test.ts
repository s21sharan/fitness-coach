import { describe, it, expect } from "vitest";
import {
  type AthleteContextProfile,
  getDefaultAthleteProfile,
  getVisibleSteps,
  hasLifting,
  hasAnySport,
  plannedSports,
  GOAL_OPTIONS,
  SPORTS,
  ATHLETE_IDENTITIES,
  AGGRESSIVENESS_OPTIONS,
} from "@/lib/onboarding/types";

function planSports(p: AthleteContextProfile, ids: Array<keyof AthleteContextProfile["sports"]>): AthleteContextProfile {
  const sports = { ...p.sports };
  for (const id of ids) {
    sports[id] = { ...sports[id], is_planned: true, enabled: true };
  }
  return { ...p, sports };
}

describe("getDefaultAthleteProfile", () => {
  it("starts every sport disabled", () => {
    const p = getDefaultAthleteProfile();
    for (const s of SPORTS) {
      expect(p.sports[s.value].enabled).toBe(false);
      expect(p.sports[s.value].is_planned).toBe(false);
    }
  });

  it("starts with empty arrays for goals, events, windows", () => {
    const p = getDefaultAthleteProfile();
    expect(p.goal_keys).toEqual([]);
    expect(p.goal_rank).toEqual([]);
    expect(p.events).toEqual([]);
    expect(p.availability_windows).toEqual([]);
    expect(p.availability_rules).toEqual([]);
    expect(p.injuries).toEqual([]);
    expect(p.equipment).toEqual([]);
    expect(p.chat_notes).toEqual([]);
  });

  it("body, recovery, coach default to nulls", () => {
    const p = getDefaultAthleteProfile();
    expect(p.body_nutrition.body_goal).toBe(null);
    expect(p.recovery.avg_sleep_hours).toBe(null);
    expect(p.coach.aggressiveness).toBe(null);
    expect(p.basic.height_cm).toBe(null);
  });
});

describe("getVisibleSteps", () => {
  it("hides events screen when no_event is true", () => {
    const p = { ...getDefaultAthleteProfile(), no_event: true };
    expect(getVisibleSteps(p)).not.toContain("events");
  });

  it("shows events screen by default", () => {
    expect(getVisibleSteps(getDefaultAthleteProfile())).toContain("events");
  });

  it("hides strength screen when lifting is not planned", () => {
    const p = planSports(getDefaultAthleteProfile(), ["run"]);
    expect(getVisibleSteps(p)).not.toContain("strength");
  });

  it("shows strength screen when lifting is planned", () => {
    const p = planSports(getDefaultAthleteProfile(), ["lift"]);
    expect(getVisibleSteps(p)).toContain("strength");
  });

  it("hides equipment screen when no sports planned", () => {
    expect(getVisibleSteps(getDefaultAthleteProfile())).not.toContain("equipment");
  });

  it("shows equipment screen when at least one sport is planned", () => {
    const p = planSports(getDefaultAthleteProfile(), ["run"]);
    expect(getVisibleSteps(p)).toContain("equipment");
  });

  it("always includes welcome, connect, sports, identity, goals, coach_style, plan_preview", () => {
    const steps = getVisibleSteps(getDefaultAthleteProfile());
    for (const s of ["welcome", "connect", "sports", "identity", "goals", "coach_style", "plan_preview"] as const) {
      expect(steps).toContain(s);
    }
  });

  it("order is welcome first, plan_preview last", () => {
    const steps = getVisibleSteps(getDefaultAthleteProfile());
    expect(steps[0]).toBe("welcome");
    expect(steps[steps.length - 1]).toBe("plan_preview");
  });
});

describe("plannedSports / hasLifting / hasAnySport", () => {
  it("plannedSports returns only planned sports", () => {
    const p = planSports(getDefaultAthleteProfile(), ["run", "lift"]);
    expect(plannedSports(p).sort()).toEqual(["lift", "run"]);
  });

  it("hasLifting is true only when lift is planned", () => {
    expect(hasLifting(getDefaultAthleteProfile())).toBe(false);
    expect(hasLifting(planSports(getDefaultAthleteProfile(), ["run"]))).toBe(false);
    expect(hasLifting(planSports(getDefaultAthleteProfile(), ["lift"]))).toBe(true);
  });

  it("hasAnySport reflects any planned sport", () => {
    expect(hasAnySport(getDefaultAthleteProfile())).toBe(false);
    expect(hasAnySport(planSports(getDefaultAthleteProfile(), ["swim"]))).toBe(true);
  });
});

describe("Constants", () => {
  it("exports a curated list of sports", () => {
    const ids = SPORTS.map((s) => s.value).sort();
    expect(ids).toEqual(["bike", "lift", "other", "run", "swim"]);
  });

  it("exports athlete identities", () => {
    expect(ATHLETE_IDENTITIES.length).toBeGreaterThan(5);
    expect(ATHLETE_IDENTITIES.map((i) => i.value)).toContain("hybrid_athlete");
  });

  it("exports a trimmed list of goal options with emojis", () => {
    expect(GOAL_OPTIONS.length).toBeGreaterThanOrEqual(7);
    expect(GOAL_OPTIONS.every((g) => g.emoji.length > 0)).toBe(true);
    expect(GOAL_OPTIONS.map((g) => g.value)).toContain("build_speed");
    expect(GOAL_OPTIONS.map((g) => g.value)).toContain("finish_a_race");
  });

  it("exports aggressiveness scale", () => {
    expect(AGGRESSIVENESS_OPTIONS.map((a) => a.value)).toEqual([
      "conservative",
      "balanced",
      "balanced_aggressive",
      "push_hard",
      "consistency_first",
    ]);
  });
});
