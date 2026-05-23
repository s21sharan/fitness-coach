import { describe, it, expect } from "vitest";
import { checkPlanAgainstSpec, hasBlockers } from "@/lib/training/spec/check-plan";
import { strengthSession, cardioSession, weekFrom, planOf, specOf } from "./builders";

const HEAVY_SQUAT = [{ name: "Back Squat", rpe: 8 }, { name: "Romanian Deadlift", rpe: 7 }];
const threshold = () => cardioSession("run", "Threshold 5x1km", { zone: 4, distance_m: 8000 });
const easyRun = (km: number) => cardioSession("run", "Easy Z2", { zone: 2, distance_m: km * 1000 });

function rules(plan: ReturnType<typeof planOf>, spec: ReturnType<typeof specOf>) {
  return checkPlanAgainstSpec(plan, spec).map((v) => v.rule);
}

describe("checkPlanAgainstSpec — heavy lower → quality run spacing", () => {
  it("flags Mon-PM heavy legs ~13h before Tue-AM threshold (the AM/PM gaming case)", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { pm: strengthSession("Lower", HEAVY_SQUAT, "pm") },
        Tue: { am: cardioSession("run", "Threshold 5x1km", { zone: 4, distance_m: 8000 }, "am") },
      }),
    ]);
    const v = checkPlanAgainstSpec(plan, specOf({ min_hours_between_heavy_lower_and_quality_run: 48 }));
    expect(v.map((x) => x.rule)).toContain("min_hours_between_heavy_lower_and_quality_run");
    expect(v.find((x) => x.rule === "min_hours_between_heavy_lower_and_quality_run")!.detail).toMatch(/13h/);
  });

  it("passes when heavy legs are a full 48h before the quality run", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { am: strengthSession("Lower", HEAVY_SQUAT, "am") },
        Wed: { am: threshold() },
      }),
    ]);
    expect(rules(plan, specOf())).not.toContain("min_hours_between_heavy_lower_and_quality_run");
  });

  it("does not flag light lower-body work (RPE 5) before a quality run", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { pm: strengthSession("Lower", [{ name: "Goblet Squat", rpe: 5 }], "pm") },
        Tue: { am: threshold() },
      }),
    ]);
    expect(rules(plan, specOf())).not.toContain("min_hours_between_heavy_lower_and_quality_run");
  });

  it("does not flag heavy legs before an EASY (Zone 2) long run", () => {
    const plan = planOf([
      weekFrom(1, {
        Fri: { am: strengthSession("Lower", HEAVY_SQUAT, "am") },
        Sat: { am: easyRun(20) },
      }),
    ]);
    expect(rules(plan, specOf())).not.toContain("min_hours_between_heavy_lower_and_quality_run");
  });

  it("catches the gap across a week boundary (Sun → next Mon)", () => {
    const plan = planOf([
      weekFrom(1, { Sun: { pm: strengthSession("Lower", HEAVY_SQUAT, "pm") } }),
      weekFrom(2, { Mon: { am: threshold() } }),
    ]);
    expect(rules(plan, specOf())).toContain("min_hours_between_heavy_lower_and_quality_run");
  });
});

describe("checkPlanAgainstSpec — quality session limits", () => {
  it("flags 3 quality cardio sessions when the per-athlete cap is 2", () => {
    const plan = planOf([
      weekFrom(1, {
        Tue: { am: threshold() },
        Thu: { am: cardioSession("bike", "Bike tempo", { zone: 4, duration_sec: 2400 }) },
        Sat: { am: cardioSession("run", "VO2 5x3", { zone: 5, distance_m: 6000 }) },
      }),
    ]);
    expect(rules(plan, specOf({ max_quality_sessions_per_week: 2 }))).toContain("max_quality_sessions_per_week");
  });

  it("allows 3 quality sessions for an athlete whose cap is 3 (no hardcoded global limit)", () => {
    const plan = planOf([
      weekFrom(1, {
        Tue: { am: threshold() },
        Thu: { am: cardioSession("bike", "Bike tempo", { zone: 4, duration_sec: 2400 }) },
        Sat: { am: cardioSession("run", "VO2 5x3", { zone: 5, distance_m: 6000 }) },
      }),
    ]);
    expect(rules(plan, specOf({ max_quality_sessions_per_week: 3 }))).not.toContain("max_quality_sessions_per_week");
  });

  it("flags quality on consecutive days when not allowed", () => {
    const plan = planOf([
      weekFrom(1, {
        Tue: { am: threshold() },
        Wed: { am: cardioSession("run", "VO2", { zone: 5, distance_m: 6000 }) },
      }),
    ]);
    expect(rules(plan, specOf({ allow_quality_back_to_back: false }))).toContain("allow_quality_back_to_back");
  });

  it("allows consecutive quality days when the spec permits it", () => {
    const plan = planOf([
      weekFrom(1, {
        Tue: { am: threshold() },
        Wed: { am: cardioSession("run", "VO2", { zone: 5, distance_m: 6000 }) },
      }),
    ]);
    expect(rules(plan, specOf({ allow_quality_back_to_back: true }))).not.toContain("allow_quality_back_to_back");
  });
});

describe("checkPlanAgainstSpec — injuries & modality restrictions", () => {
  it("flags a Bulgarian Split Squat when loaded_knee_flexion is forbidden", () => {
    const plan = planOf([
      weekFrom(1, {
        Wed: { am: strengthSession("Lower", [{ name: "Bulgarian Split Squat (shallow depth)", rpe: 7 }]) },
      }),
    ]);
    expect(rules(plan, specOf({ forbidden_movement_patterns: ["loaded_knee_flexion"] }))).toContain(
      "forbidden_movement_patterns",
    );
  });

  it("still allows RDL (a hip-hinge) when only loaded_knee_flexion is forbidden", () => {
    const plan = planOf([
      weekFrom(1, {
        Wed: { am: strengthSession("Lower", [{ name: "Romanian Deadlift", rpe: 7 }]) },
      }),
    ]);
    expect(rules(plan, specOf({ forbidden_movement_patterns: ["loaded_knee_flexion"] }))).not.toContain(
      "forbidden_movement_patterns",
    );
  });

  it("flags any running session when run is a forbidden modality", () => {
    const plan = planOf([weekFrom(1, { Tue: { am: easyRun(5) } })]);
    expect(rules(plan, specOf({ forbidden_modalities: ["run"] }))).toContain("forbidden_modalities");
  });

  it("flags a swim scheduled outside its allowed days", () => {
    const plan = planOf([
      weekFrom(1, {
        Wed: { am: cardioSession("swim", "Swim Z2", { zone: 2, duration_sec: 1800 }) },
      }),
    ]);
    const spec = specOf({ required_modality_days: [{ modality: "swim", days: ["Tue", "Thu"] }] });
    expect(rules(plan, spec)).toContain("required_modality_days");
  });

  it("accepts a swim on an allowed day", () => {
    const plan = planOf([
      weekFrom(1, {
        Tue: { am: cardioSession("swim", "Swim Z2", { zone: 2, duration_sec: 1800 }) },
      }),
    ]);
    const spec = specOf({ required_modality_days: [{ modality: "swim", days: ["Tue", "Thu"] }] });
    expect(rules(plan, spec)).not.toContain("required_modality_days");
  });
});

describe("checkPlanAgainstSpec — weekly counts", () => {
  it("flags exceeding the training-days ceiling", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { am: easyRun(5) },
        Tue: { am: easyRun(5) },
        Wed: { am: easyRun(5) },
        Thu: { am: easyRun(5) },
      }),
    ]);
    expect(rules(plan, specOf({ days_per_week: 3 }))).toContain("days_per_week");
  });

  it("flags exceeding the lifting-days cap", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { am: strengthSession("A", [{ name: "Bench", rpe: 7 }]) },
        Wed: { am: strengthSession("B", [{ name: "OHP", rpe: 7 }]) },
        Fri: { am: strengthSession("C", [{ name: "Bench", rpe: 7 }]) },
      }),
    ]);
    expect(rules(plan, specOf({ lifting_days_per_week: 2 }))).toContain("lifting_days_per_week");
  });
});

describe("checkPlanAgainstSpec — clean plan", () => {
  it("returns no violations for a well-formed plan", () => {
    const plan = planOf([
      weekFrom(1, {
        Mon: { am: strengthSession("Upper", [{ name: "Bench Press", rpe: 7 }]) },
        Tue: { am: easyRun(8) },
        Wed: { am: strengthSession("Lower", HEAVY_SQUAT, "am") },
        Fri: { am: threshold() },
        Sat: { am: easyRun(16) },
      }),
    ]);
    const spec = specOf({
      days_per_week: 5,
      lifting_days_per_week: 2,
      max_quality_sessions_per_week: 2,
      allow_quality_back_to_back: false,
    });
    const v = checkPlanAgainstSpec(plan, spec);
    expect(v).toEqual([]);
    expect(hasBlockers(v)).toBe(false);
  });
});

describe("checkPlanAgainstSpec — volume ramp (advisory)", () => {
  it("flags a >10% week-over-week running increase as a warning", () => {
    const plan = planOf([
      weekFrom(1, { Sat: { am: easyRun(20) } }),
      weekFrom(2, { Sat: { am: easyRun(30) } }),
    ]);
    const v = checkPlanAgainstSpec(plan, specOf({ max_weekly_volume_increase_pct: 10 }));
    const ramp = v.find((x) => x.rule === "max_weekly_volume_increase_pct");
    expect(ramp).toBeDefined();
    expect(ramp!.severity).toBe("warning");
  });

  it("does not flag the reload week after a deload", () => {
    const plan = planOf([
      weekFrom(1, { Sat: { am: easyRun(30) } }),
      weekFrom(2, { Sat: { am: easyRun(18) } }), // deload
      weekFrom(3, { Sat: { am: easyRun(31) } }), // reload toward pre-deload level
    ]);
    const v = checkPlanAgainstSpec(plan, specOf({ max_weekly_volume_increase_pct: 10 }));
    expect(v.find((x) => x.rule === "max_weekly_volume_increase_pct" && x.week === 3)).toBeUndefined();
  });
});
