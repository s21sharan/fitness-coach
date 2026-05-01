import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";

describe("buildSystemPrompt", () => {
  it("includes user profile data", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: "shoulders", days_per_week: 6, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: { split_type: "ppl", plan_config: null },
      todaySession: "Push",
      recovery: { hrv: 52, sleep_hours: 7.8, resting_hr: 58, body_battery: 75 },
      todayNutrition: { calories: 1800, protein: 142 },
      weekStats: { sessionsCompleted: 3, sessionsPlanned: 6 },
    });
    expect(prompt).toContain("28");
    expect(prompt).toContain("180");
    expect(prompt).toContain("shoulders");
    expect(prompt).toContain("Push");
    expect(prompt).toContain("52");
    expect(prompt).toContain("7.8");
  });

  it("includes race info when training for race", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 30, height: 175, weight: 170, sex: "male", training_experience: "advanced" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 6, training_for_race: true, race_type: "half_ironman", race_date: "2026-09-15", goal_time: "5:30:00" },
      plan: { split_type: "hybrid_upper_lower", plan_config: { periodization_phase: "build", race_weeks_out: 20 } },
      todaySession: "Upper Body + Easy Run (Zone 2)",
      recovery: null,
      todayNutrition: null,
      weekStats: { sessionsCompleted: 4, sessionsPlanned: 6 },
    });
    expect(prompt).toContain("Half Ironman");
    expect(prompt).toContain("2026-09-15");
    expect(prompt).toContain("5:30:00");
    expect(prompt).toContain("Build");
    expect(prompt).toContain("20 weeks");
  });

  it("includes coaching personality guidelines", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 25, height: 170, weight: 150, sex: "female", training_experience: "beginner" },
      goals: { body_goal: "lose_weight", emphasis: null, days_per_week: 4, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
    });
    expect(prompt).toContain("Coach");
    expect(prompt).toContain("specific, actionable advice");
    expect(prompt).toContain("concise");
  });
});
