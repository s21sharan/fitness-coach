import { describe, it, expect } from "vitest";
import {
  deriveTrainingPaces,
  pickBestRecentRun,
  computeGoalBlendWeight,
  parseGoalTimeToSec,
  raceTypeToDistanceKm,
  formatPaceSecPerKm,
  cardioLogsToRunRecords,
  type RunRecord,
} from "@/lib/training/training-paces";

const TODAY = new Date("2026-05-17T12:00:00");

function daysAgo(d: number): string {
  const t = new Date(TODAY);
  t.setDate(t.getDate() - d);
  return t.toISOString().slice(0, 10);
}

describe("pickBestRecentRun", () => {
  it("returns null when no runs qualify", () => {
    const runs: RunRecord[] = [
      { date: daysAgo(10), distanceKm: 2, durationSec: 600 }, // too short
      { date: daysAgo(200), distanceKm: 10, durationSec: 3000 }, // too old
    ];
    expect(pickBestRecentRun(runs, TODAY)).toBeNull();
  });

  it("picks the run with the best Riegel-projected 5K", () => {
    const runs: RunRecord[] = [
      // 10K @ 5:00/km → strong
      { date: daysAgo(20), distanceKm: 10, durationSec: 50 * 60 },
      // 5K @ 6:00/km → weaker
      { date: daysAgo(5), distanceKm: 5, durationSec: 30 * 60 },
      // 15K @ 5:30/km → strongest aerobic base
      { date: daysAgo(30), distanceKm: 15, durationSec: 82 * 60 + 30 },
    ];
    const best = pickBestRecentRun(runs, TODAY);
    expect(best?.distanceKm).toBe(10);
  });
});

describe("computeGoalBlendWeight", () => {
  it("returns 0 with no race date", () => {
    expect(computeGoalBlendWeight(null, TODAY)).toBe(0);
  });

  it("returns 0 for races beyond the horizon (16 weeks)", () => {
    expect(computeGoalBlendWeight(daysAgo(-200), TODAY)).toBe(0);
  });

  it("ramps linearly inside the horizon", () => {
    // 8 weeks out → ~half of the max blend.
    const eightWeeks = computeGoalBlendWeight(daysAgo(-56), TODAY);
    expect(eightWeeks).toBeCloseTo(0.3, 1); // 0.6 * (1 - 8/16) = 0.3
  });

  it("caps at MAX_BLEND_TO_GOAL on/after race day", () => {
    expect(computeGoalBlendWeight(daysAgo(1), TODAY)).toBe(0.6);
  });
});

describe("deriveTrainingPaces", () => {
  it("returns null when no usable run and no goal", () => {
    expect(deriveTrainingPaces([], null, TODAY)).toBeNull();
  });

  it("derives paces from a single strong recent run", () => {
    const runs: RunRecord[] = [
      // 10K @ 4:30/km → Riegel projects to a 5K of ~21:30, so 5K pace ~ 4:18/km
      { date: daysAgo(15), distanceKm: 10, durationSec: 45 * 60 },
    ];
    const paces = deriveTrainingPaces(runs, null, TODAY);
    expect(paces).not.toBeNull();
    if (!paces) return;

    expect(paces.basis.source).toBe("recent");
    expect(paces.basis.blendGoalWeight).toBe(0);
    // Easy should be slower than threshold which should be slower than 5K.
    expect(paces.easy).toBeGreaterThan(paces.threshold);
    expect(paces.threshold).toBeGreaterThan(paces.m5k);
    expect(paces.m5k).toBeGreaterThan(paces.interval);
    expect(paces.interval).toBeGreaterThan(paces.repetition);
    // 10K pace should sit between threshold and 5K pace.
    expect(paces.m10k).toBeLessThan(paces.threshold);
    expect(paces.m10k).toBeGreaterThan(paces.m5k);
    // Sanity check: 5K pace should be roughly 4:18/km (258s) ± 10s.
    expect(paces.m5k).toBeGreaterThan(250);
    expect(paces.m5k).toBeLessThan(270);
  });

  it("blends toward a closer goal race", () => {
    const runs: RunRecord[] = [
      // Slow baseline: 10K @ 5:30/km (recent 5K equiv ~26:15)
      { date: daysAgo(20), distanceKm: 10, durationSec: 55 * 60 },
    ];
    // Goal: half marathon in 1:35 (5:42/mi ≈ 4:30/km) 4 weeks out.
    const goal = {
      distanceKm: 21.0975,
      goalTimeSec: 95 * 60,
      date: daysAgo(-28),
    };
    const pacesNoGoal = deriveTrainingPaces(runs, null, TODAY)!;
    const pacesWithGoal = deriveTrainingPaces(runs, goal, TODAY)!;

    // Goal pace is faster than recent fitness, so blended paces should be
    // strictly faster (lower sec/km) than recent-only paces.
    expect(pacesWithGoal.m5k).toBeLessThan(pacesNoGoal.m5k);
    expect(pacesWithGoal.basis.source).toBe("blended");
    expect(pacesWithGoal.basis.blendGoalWeight).toBeGreaterThan(0);
  });

  it("falls back to goal-only when no recent runs exist", () => {
    const goal = { distanceKm: 10, goalTimeSec: 40 * 60, date: daysAgo(-30) };
    const paces = deriveTrainingPaces([], goal, TODAY)!;
    expect(paces.basis.source).toBe("goal");
    expect(paces.basis.blendGoalWeight).toBe(1);
  });
});

describe("parseGoalTimeToSec", () => {
  it("parses H:MM:SS", () => {
    expect(parseGoalTimeToSec("1:35:00")).toBe(5700);
  });
  it("parses MM:SS", () => {
    expect(parseGoalTimeToSec("42:30")).toBe(2550);
  });
  it("returns null on garbage", () => {
    expect(parseGoalTimeToSec("foo")).toBeNull();
    expect(parseGoalTimeToSec("")).toBeNull();
    expect(parseGoalTimeToSec(null)).toBeNull();
  });
});

describe("raceTypeToDistanceKm", () => {
  it("maps known race types", () => {
    expect(raceTypeToDistanceKm("5k")).toBe(5);
    expect(raceTypeToDistanceKm("marathon")).toBe(42.195);
  });
  it("returns null for triathlon and ultras", () => {
    expect(raceTypeToDistanceKm("ultra")).toBeNull();
    expect(raceTypeToDistanceKm("sprint_tri")).toBeNull();
  });
});

describe("formatPaceSecPerKm", () => {
  it("formats correctly", () => {
    expect(formatPaceSecPerKm(330)).toBe("5:30/km");
    expect(formatPaceSecPerKm(258)).toBe("4:18/km");
  });
});

describe("cardioLogsToRunRecords", () => {
  it("filters non-runs and zero-distance logs", () => {
    const records = cardioLogsToRunRecords([
      { date: "2026-05-01", type: "run", distance: 10, duration: 3000 },
      { date: "2026-05-02", type: "ride", distance: 30, duration: 3600 },
      { date: "2026-05-03", type: "trail_running", distance: 12, duration: 4000 },
      { date: "2026-05-04", type: "run", distance: 0, duration: 1800 },
    ]);
    expect(records).toHaveLength(2);
    expect(records[0].distanceKm).toBe(10);
    expect(records[1].distanceKm).toBe(12);
  });
});
