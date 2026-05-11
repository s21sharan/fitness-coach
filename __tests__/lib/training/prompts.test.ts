import { describe, it, expect } from "vitest";
import { buildUserPrompt } from "@/lib/training/prompts";
import type { UserContext, RecentActivity } from "@/lib/training/prompts";

const baseCtx: UserContext = {
  age: 30,
  height: 175,
  weight: 170,
  sex: "male",
  experience: "intermediate",
  bodyGoal: "gain_muscle",
  emphasis: null,
  daysPerWeek: 5,
  liftingDays: null,
  trainingForRace: false,
  raceType: null,
  raceDate: null,
  goalTime: null,
  doesCardio: false,
  cardioTypes: [],
  recentActivity: null,
};

describe("buildUserPrompt", () => {
  it("includes basic user profile info", () => {
    const prompt = buildUserPrompt(baseCtx);
    expect(prompt).toContain("Age: 30");
    expect(prompt).toContain("Sex: male");
    expect(prompt).toContain("Height: 175 cm");
    expect(prompt).toContain("Weight: 170 lbs");
    expect(prompt).toContain("Experience: intermediate");
    expect(prompt).toContain("Goal: Gain muscle");
    expect(prompt).toContain("Available days per week: 5");
  });

  it("works without recentActivity (null)", () => {
    const prompt = buildUserPrompt({ ...baseCtx, recentActivity: null });
    expect(prompt).not.toContain("Recent activity data");
    expect(prompt).not.toContain("Weekly runs");
    expect(prompt).toContain("Today's date:");
  });

  it("includes recent activity data when provided", () => {
    const recentActivity: RecentActivity = {
      avgRunPaceMinKm: 5.5,
      avgRunDistanceKm: 8.2,
      avgRunHr: 148,
      weeklyRunCount: 3,
      weeklyLiftCount: 4,
      avgLiftDurationMin: 55,
      avgHrv: 62,
      avgSleepHours: 7.5,
    };

    const prompt = buildUserPrompt({ ...baseCtx, recentActivity });
    expect(prompt).toContain("Recent activity data (last 30 days):");
    expect(prompt).toContain("Avg easy run pace: 5.5 min/km");
    expect(prompt).toContain("Avg run distance: 8.2 km");
    expect(prompt).toContain("Avg run HR: 148 bpm");
    expect(prompt).toContain("Weekly runs: 3, weekly lifts: 4");
    expect(prompt).toContain("Avg lifting session: 55 min");
    expect(prompt).toContain("Avg HRV: 62");
    expect(prompt).toContain("Avg sleep: 7.5h");
    expect(prompt).toContain("Use this data to set realistic pace, distance, and duration targets for each workout.");
  });

  it("omits optional activity fields when null", () => {
    const recentActivity: RecentActivity = {
      avgRunPaceMinKm: null,
      avgRunDistanceKm: null,
      avgRunHr: null,
      weeklyRunCount: 2,
      weeklyLiftCount: 3,
      avgLiftDurationMin: null,
      avgHrv: null,
      avgSleepHours: null,
    };

    const prompt = buildUserPrompt({ ...baseCtx, recentActivity });
    expect(prompt).toContain("Recent activity data (last 30 days):");
    expect(prompt).toContain("Weekly runs: 2, weekly lifts: 3");
    expect(prompt).not.toContain("Avg easy run pace");
    expect(prompt).not.toContain("Avg run distance");
    expect(prompt).not.toContain("Avg run HR");
    expect(prompt).not.toContain("Avg lifting session");
    expect(prompt).not.toContain("Avg HRV");
    expect(prompt).not.toContain("Avg sleep");
  });

  it("includes race info when training for a race", () => {
    const ctx: UserContext = {
      ...baseCtx,
      bodyGoal: "maintain",
      trainingForRace: true,
      raceType: "marathon",
      raceDate: "2026-10-01",
      goalTime: "3:30:00",
    };
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain("Training for: Marathon");
    expect(prompt).toContain("Goal time: 3:30:00");
  });

  it("includes cardio info when not training for a race", () => {
    const ctx: UserContext = {
      ...baseCtx,
      doesCardio: true,
      cardioTypes: ["running", "cycling"],
    };
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain("Also does cardio: running, cycling");
  });
});
