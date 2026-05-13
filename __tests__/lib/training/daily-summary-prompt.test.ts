import { describe, it, expect } from "vitest";
import { buildDailySummaryPrompt, DAILY_SUMMARY_SYSTEM_PROMPT } from "@/lib/training/daily-summary-prompt";

describe("buildDailySummaryPrompt", () => {
  it("includes recovery data in prompt", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: { sleep_hours: 7.2, sleep_score: 82, hrv: 52, resting_hr: 54, body_battery: 71, stress_level: 28, steps: 4200 },
      avgHrv7: 48,
      workoutsToday: [],
      cardioToday: [],
      plannedToday: null,
      trainingHistory: { muscleVolume: {}, exerciseHistory: [] },
    });
    expect(prompt).toContain("Sleep: 7.2h (score: 82)");
    expect(prompt).toContain("HRV: 52 (7-day avg: 48)");
    expect(prompt).toContain("Resting HR: 54 bpm");
  });

  it("includes cardio activities", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: null,
      avgHrv7: null,
      workoutsToday: [],
      cardioToday: [{ type: "run", distance: 8.1, duration: 2730, avg_hr: 138, pace_or_speed: 5.62, calories: 412, elevation: 45 }],
      plannedToday: null,
      trainingHistory: { muscleVolume: {}, exerciseHistory: [] },
    });
    expect(prompt).toContain("Run");
    expect(prompt).toContain("8.1 km");
  });

  it("includes muscle volume and exercise history", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: null,
      avgHrv7: null,
      workoutsToday: [],
      cardioToday: [],
      plannedToday: "Pull day",
      trainingHistory: {
        muscleVolume: { chest: { sets: 18, volume: 14400 }, calves: { sets: 0, volume: 0 } },
        exerciseHistory: [
          { name: "Bench Press", sessions: 3, bestWeight: 85, bestReps: 6, totalSets: 9, lastRpe: 8, progression: "plateau" as const },
        ],
      },
    });
    expect(prompt).toContain("PLANNED TODAY: Pull day");
    expect(prompt).toContain("chest: 18 sets");
    expect(prompt).toContain("calves: 0 sets");
    expect(prompt).toContain("Bench Press");
    expect(prompt).toContain("plateau");
  });

  it("system prompt requires specific recommendations", () => {
    expect(DAILY_SUMMARY_SYSTEM_PROMPT).toContain("specific");
    expect(DAILY_SUMMARY_SYSTEM_PROMPT).toContain("exercise");
  });
});
