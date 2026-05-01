import { describe, it, expect, vi } from "vitest";
import { buildAdjustmentPrompt } from "../../src/adjustment/weekly-check-in.js";

vi.mock("../../src/db.js", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("../../src/config.js", () => ({
  config: {},
}));

describe("weekly-check-in", () => {
  describe("buildAdjustmentPrompt", () => {
    it("includes compliance and recovery data in prompt", () => {
      const prompt = buildAdjustmentPrompt({
        splitType: "ppl",
        bodyGoal: "gain_muscle",
        raceType: null,
        planConfig: { deload_frequency: 4 },
        weekData: {
          compliance: 83,
          avgCalories: 2400,
          avgProtein: 175,
          avgSleepHours: 6.8,
          avgHrv: 45,
          planned: [],
          workoutLogs: [],
          cardioLogs: [],
          nutritionLogs: [],
          recoveryLogs: [],
        },
      });

      expect(prompt).toContain("83%");
      expect(prompt).toContain("2400");
      expect(prompt).toContain("6.8");
      expect(prompt).toContain("45");
      expect(prompt).toContain("ppl");
    });
  });
});
