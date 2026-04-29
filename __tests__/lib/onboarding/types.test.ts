import { describe, it, expect } from "vitest";
import {
  type OnboardingData,
  BODY_GOALS,
  EMPHASIS_OPTIONS,
  RACE_TYPES,
  EXPERIENCE_LEVELS,
  CARDIO_TYPES,
  getDefaultOnboardingData,
  getVisibleSteps,
} from "@/lib/onboarding/types";

describe("OnboardingData", () => {
  it("provides correct default values", () => {
    const data = getDefaultOnboardingData();
    expect(data.height).toBe(null);
    expect(data.weight).toBe(null);
    expect(data.age).toBe(null);
    expect(data.sex).toBe(null);
    expect(data.bodyGoal).toBe(null);
    expect(data.emphasis).toBe(null);
    expect(data.trainingForRace).toBe(false);
    expect(data.raceType).toBe(null);
    expect(data.raceDate).toBe(null);
    expect(data.goalTime).toBe(null);
    expect(data.doesCardio).toBe(false);
    expect(data.cardioTypes).toEqual([]);
    expect(data.experience).toBe(null);
    expect(data.daysPerWeek).toBe(null);
    expect(data.liftingDays).toBe(null);
  });
});

describe("getVisibleSteps", () => {
  it("shows emphasis step when body goal is gain_muscle", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "gain_muscle";
    const steps = getVisibleSteps(data);
    expect(steps).toContain("emphasis");
  });

  it("shows emphasis step when body goal is maintain", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "maintain";
    const steps = getVisibleSteps(data);
    expect(steps).toContain("emphasis");
  });

  it("hides emphasis step when body goal is lose_weight", () => {
    const data = getDefaultOnboardingData();
    data.bodyGoal = "lose_weight";
    const steps = getVisibleSteps(data);
    expect(steps).not.toContain("emphasis");
  });

  it("shows race details when training for a race", () => {
    const data = getDefaultOnboardingData();
    data.trainingForRace = true;
    const steps = getVisibleSteps(data);
    expect(steps).toContain("race_details");
    expect(steps).not.toContain("cardio");
  });

  it("shows cardio step when not training for a race", () => {
    const data = getDefaultOnboardingData();
    data.trainingForRace = false;
    const steps = getVisibleSteps(data);
    expect(steps).toContain("cardio");
    expect(steps).not.toContain("race_details");
  });

  it("always includes profile, body_goal, race, experience, availability, integrations, split_result", () => {
    const data = getDefaultOnboardingData();
    const steps = getVisibleSteps(data);
    expect(steps).toContain("profile");
    expect(steps).toContain("body_goal");
    expect(steps).toContain("race");
    expect(steps).toContain("experience");
    expect(steps).toContain("availability");
    expect(steps).toContain("integrations");
    expect(steps).toContain("split_result");
  });
});

describe("Constants", () => {
  it("has all body goal options", () => {
    expect(BODY_GOALS).toEqual([
      { value: "gain_muscle", label: "Gain Muscle" },
      { value: "lose_weight", label: "Lose Weight" },
      { value: "maintain", label: "Maintain / Recomp" },
      { value: "other", label: "Other" },
    ]);
  });

  it("has all emphasis options", () => {
    expect(EMPHASIS_OPTIONS.map((o) => o.value)).toEqual([
      "shoulders", "chest", "back", "arms", "legs", "glutes", "none",
    ]);
  });

  it("has all race types grouped by category", () => {
    const runningValues = RACE_TYPES.filter((r) => r.category === "running").map((r) => r.value);
    expect(runningValues).toEqual(["5k", "10k", "half_marathon", "marathon", "ultra"]);
    const triValues = RACE_TYPES.filter((r) => r.category === "triathlon").map((r) => r.value);
    expect(triValues).toEqual(["sprint_tri", "olympic_tri", "half_ironman", "ironman"]);
  });

  it("has experience levels", () => {
    expect(EXPERIENCE_LEVELS.map((e) => e.value)).toEqual([
      "beginner", "intermediate", "advanced",
    ]);
  });
});
