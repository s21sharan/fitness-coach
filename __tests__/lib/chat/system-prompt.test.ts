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
      weekStats: null,
    });
    expect(prompt).toContain("Coach");
    expect(prompt).toContain("specific, actionable advice");
    expect(prompt).toContain("concise");
  });

  it("includes reasoning framework with recovery gating heuristics", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      weekStats: null,
    });
    expect(prompt).toContain("Training Decision Framework");
    expect(prompt).toContain("Recovery gating");
    expect(prompt).toContain("HRV");
  });

  it("includes calendar tool guidance for create / update / regenerate", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      weekStats: null,
    });
    expect(prompt).toContain("create_planned_workout");
    expect(prompt).toContain("update_planned_workout");
    expect(prompt).toContain("regenerate_plan");
  });

  it("includes the strict date rule referencing today's date", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      weekStats: null,
    });
    expect(prompt).toContain("Date rule");
    expect(prompt).toContain("STRICT");
    expect(prompt).toContain("Past sessions are immutable");
  });

  it("includes contract emission rules so the coach knows how to produce structured sessions", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      weekStats: null,
    });
    expect(prompt).toContain("Contract emission rules");
    expect(prompt).toContain("version=1");
    expect(prompt).toContain("exercise_name");
  });

  it("includes block context when block is provided", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: { split_type: "ppl", plan_config: null },
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
      block: {
        block_id: "block-abc",
        block_type: "build",
        block_label: "Build Block",
        block_number: 2,
        week_count: 4,
        current_week: 3,
        end_date: "2026-05-25",
        days_until_end: 10,
        compliance_pct: 87,
      },
    });
    expect(prompt).toContain("Build Block");
    expect(prompt).toContain("Block 2");
    expect(prompt).toContain("Week 3 of 4");
    expect(prompt).toContain("Block ends: 2026-05-25");
    expect(prompt).toContain("Block compliance: 87%");
    // block_id is present as loose metadata (NOT a handle for tools)
    expect(prompt).toContain("Block id: block-abc");
    expect(prompt).toContain("loose metadata");
  });

  it("does not append days_until_end to Block ends line when more than 3 days remain", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
      block: {
        block_id: "block-def",
        block_type: "build",
        block_label: "Build Block",
        block_number: 1,
        week_count: 4,
        current_week: 1,
        end_date: "2026-05-30",
        days_until_end: 10,
        compliance_pct: null,
      },
    });
    expect(prompt).toContain("Block ends: 2026-05-30");
    expect(prompt).not.toContain("(10 days)");
    expect(prompt).not.toContain("IMPORTANT: The athlete's current block ends in");
  });

  it("includes proactive trigger and days countdown when block ends within 3 days", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 30, height: 175, weight: 170, sex: "male", training_experience: "advanced" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 6, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
      block: {
        block_id: "block-ghi",
        block_type: "peak",
        block_label: "Peak Block",
        block_number: 3,
        week_count: 3,
        current_week: 3,
        end_date: "2026-05-14",
        days_until_end: 2,
        compliance_pct: 92,
      },
    });
    expect(prompt).toContain("Block ends: 2026-05-14 (2 days)");
    expect(prompt).toContain("IMPORTANT: The athlete's current block ends in 2 days");
    expect(prompt).toContain("propose_next_block");
  });

  it("includes propose_next_block in guidelines", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 25, height: 170, weight: 150, sex: "female", training_experience: "beginner" },
      goals: { body_goal: "lose_weight", emphasis: null, days_per_week: 4, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
    });
    expect(prompt).toContain("propose_next_block");
    expect(prompt).toContain("regenerate_plan");
  });

  it("omits block section entirely when block is null", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
      block: null,
    });
    expect(prompt).not.toContain("Current block:");
    expect(prompt).not.toContain("Block ends:");
    expect(prompt).not.toContain("Block compliance:");
  });

  it("renders training availability windows and rules when provided", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
      availability: {
        windows: [
          { day_of_week: 0, start_time: "06:00", end_time: "12:00", max_duration_min: 90, session_count: 1 },
          { day_of_week: 0, start_time: "16:00", end_time: "22:00", max_duration_min: 60, session_count: 1 },
          { day_of_week: 1, start_time: "06:00", end_time: "10:00", max_duration_min: 60, session_count: 1 },
        ],
        rules: [{ rule_key: "prefer_morning", params: {} }],
      },
    });
    expect(prompt).toContain("Training availability:");
    expect(prompt).toContain("Mon: 06:00–12:00, 90min cap | 16:00–22:00, 60min cap");
    expect(prompt).toContain("Tue: 06:00–10:00, 60min cap");
    // Days without windows show as rest
    expect(prompt).toContain("Wed: rest");
    expect(prompt).toContain("Schedule rules: prefer_morning");
    expect(prompt).toContain("Schedule-respect rules:");
  });

  it("anchors weekdays with an explicit upcoming-dates table so the coach can't hallucinate them", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
    });
    expect(prompt).toContain("Upcoming dates");
    expect(prompt).toContain("This week's Monday:");
    expect(prompt).toContain("Next Monday:");
    // Should list at least 14 entries with day-of-week abbreviations.
    const dowMatches = prompt.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}/g);
    expect(dowMatches?.length ?? 0).toBeGreaterThanOrEqual(14);
  });

  it("registers the new calendar tools in the prompt guidance", () => {
    const prompt = buildSystemPrompt({
      profile: { age: 28, height: 180, weight: 185, sex: "male", training_experience: "intermediate" },
      goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, training_for_race: false, race_type: null, race_date: null, goal_time: null },
      plan: null,
      todaySession: null,
      recovery: null,
      todayNutrition: null,
      weekStats: null,
    });
    expect(prompt).toContain("delete_planned_workout");
    expect(prompt).toContain("create_planned_workouts_batch");
    expect(prompt).toContain("modify_planned_workouts");
    expect(prompt).toContain("delete_planned_workouts");
    expect(prompt).toContain("swap_planned_workouts");
    expect(prompt).toContain("LOOSE METADATA");
  });
});
