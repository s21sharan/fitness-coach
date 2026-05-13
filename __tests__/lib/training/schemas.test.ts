import { describe, it, expect } from "vitest";
import { planGenerationSchema, dayLayoutSchema, workoutTargetsSchema, multiWeekPlanSchema, type PlanGeneration, type WorkoutTargets, type MultiWeekPlan } from "@/lib/training/schemas";

describe("planGenerationSchema", () => {
  it("validates a correct PPL plan", () => {
    const plan: PlanGeneration = {
      split_type: "ppl",
      reasoning: "6 days with balanced emphasis — PPL is the gold standard.",
      weekly_layout: [
        { day_of_week: 0, session_type: "Push", ai_notes: null },
        { day_of_week: 1, session_type: "Pull", ai_notes: null },
        { day_of_week: 2, session_type: "Legs", ai_notes: null },
        { day_of_week: 3, session_type: "Rest", ai_notes: null },
        { day_of_week: 4, session_type: "Push", ai_notes: null },
        { day_of_week: 5, session_type: "Pull", ai_notes: null },
        { day_of_week: 6, session_type: "Rest", ai_notes: null },
      ],
      plan_config: {
        deload_frequency: 4,
      },
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("validates a hybrid race plan with periodization", () => {
    const plan: PlanGeneration = {
      split_type: "hybrid_upper_lower",
      reasoning: "Half Ironman in 12 weeks — build phase with 3 lift + 3 cardio.",
      weekly_layout: [
        { day_of_week: 0, session_type: "Upper Body + Easy Run (Zone 2)", ai_notes: "Keep run under 5km" },
        { day_of_week: 1, session_type: "Tempo Run", ai_notes: null },
        { day_of_week: 2, session_type: "Lower Body", ai_notes: null },
        { day_of_week: 3, session_type: "Easy Run (Zone 2) + Swim", ai_notes: null },
        { day_of_week: 4, session_type: "Upper Body", ai_notes: null },
        { day_of_week: 5, session_type: "Long Ride + Brick Run", ai_notes: "Aim for 60km ride + 15 min brick" },
        { day_of_week: 6, session_type: "Rest", ai_notes: null },
      ],
      plan_config: {
        periodization_phase: "build",
        race_weeks_out: 12,
        deload_frequency: 3,
        notes: "Transition to peak phase at week 16",
      },
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("rejects invalid split type", () => {
    const plan = {
      split_type: "invalid_split",
      reasoning: "test",
      weekly_layout: [],
      plan_config: {},
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("requires exactly 7 days in weekly_layout", () => {
    const plan = {
      split_type: "ppl",
      reasoning: "test",
      weekly_layout: [
        { day_of_week: 0, session_type: "Push", ai_notes: null },
      ],
      plan_config: {},
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});

describe("workoutTargetsSchema", () => {
  it("validates cardio targets with all fields set", () => {
    const targets: WorkoutTargets = {
      target_distance_km: 10,
      target_duration_min: 60,
      target_pace_min_km: 6.0,
      target_hr_zone: 2,
      target_hr_max: 155,
      muscle_focus: null,
    };

    const result = workoutTargetsSchema.safeParse(targets);
    expect(result.success).toBe(true);
  });

  it("validates empty targets object (all fields optional)", () => {
    const result = workoutTargetsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects target_hr_zone outside 1-5 range", () => {
    const result = workoutTargetsSchema.safeParse({ target_hr_zone: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects target_hr_zone of 0", () => {
    const result = workoutTargetsSchema.safeParse({ target_hr_zone: 0 });
    expect(result.success).toBe(false);
  });
});

describe("multiWeekPlanSchema", () => {
  it("validates a 2-week hybrid plan with AM/PM splits", () => {
    const plan = {
      split_type: "hybrid_nick_bare",
      narrative: "Week 1 builds aerobic base with AM lifting and PM zone 2 cardio. Week 2 introduces tempo work.",
      risks: ["High weekly volume may cause cumulative fatigue", "Back-to-back hard days on Wed/Thu"],
      plan_config: {
        periodization_phase: "build",
        race_weeks_out: 16,
        deload_frequency: 4,
        notes: "Taper starts week 14",
      },
      weeks: [
        {
          week_number: 1,
          week_focus: "Aerobic base + full body strength",
          days: [
            { day_label: "Mon", am_session: "Upper Body Push", am_rationale: "Fresh legs after rest day", pm_session: "Zone 2 Run 45min", pm_rationale: "Low intensity, aerobic base", is_rest: false, notes: null },
            { day_label: "Tue", am_session: "Lower Body", am_rationale: "Leg drive for running", pm_session: null, pm_rationale: null, is_rest: false, notes: "Focus on squat and Romanian deadlift" },
            { day_label: "Wed", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Full rest, focus on nutrition" },
            { day_label: "Thu", am_session: "Upper Body Pull", am_rationale: "Balance push/pull ratio", pm_session: "Easy Swim 30min", pm_rationale: "Active recovery modality", is_rest: false, notes: null },
            { day_label: "Fri", am_session: "Zone 2 Bike 60min", am_rationale: "Aerobic base building", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Sat", am_session: "Long Run 12km", am_rationale: "Weekly long effort", pm_session: null, pm_rationale: null, is_rest: false, notes: "HR cap at zone 3" },
            { day_label: "Sun", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null },
          ],
        },
        {
          week_number: 2,
          week_focus: "Introduce tempo and lactate threshold work",
          days: [
            { day_label: "Mon", am_session: "Upper Body Push", am_rationale: "Repeat pattern", pm_session: "Zone 2 Run 50min", pm_rationale: "Slight volume increase", is_rest: false, notes: null },
            { day_label: "Tue", am_session: "Lower Body", am_rationale: "Maintain leg strength", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Wed", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null },
            { day_label: "Thu", am_session: "Tempo Run 8km", am_rationale: "Lactate threshold stimulus", pm_session: null, pm_rationale: null, is_rest: false, notes: "Target zone 4" },
            { day_label: "Fri", am_session: "Upper Body Pull", am_rationale: "Pulling pattern maintenance", pm_session: "Easy Swim 30min", pm_rationale: "Flush legs post-tempo", is_rest: false, notes: null },
            { day_label: "Sat", am_session: "Long Run 14km", am_rationale: "Progressive overload on long run", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Sun", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null },
          ],
        },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("validates a lifting-only 2-week PPL plan", () => {
    const makeDays = (sessions: Array<{ am: string | null; pm: string | null; rest: boolean }>) =>
      (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((day_label, i) => ({
        day_label,
        am_session: sessions[i].am,
        am_rationale: sessions[i].am ? "Primary session" : null,
        pm_session: sessions[i].pm,
        pm_rationale: null,
        is_rest: sessions[i].rest,
        notes: null,
      }));

    const week1Days = makeDays([
      { am: "Push", pm: null, rest: false },
      { am: "Pull", pm: null, rest: false },
      { am: "Legs", pm: null, rest: false },
      { am: null, pm: null, rest: true },
      { am: "Push", pm: null, rest: false },
      { am: "Pull", pm: null, rest: false },
      { am: null, pm: null, rest: true },
    ]);

    const plan = {
      split_type: "ppl",
      narrative: "Classic PPL structure over 2 weeks with a deload in week 4.",
      risks: ["High frequency may not suit beginners"],
      plan_config: { deload_frequency: 4 },
      weeks: [
        { week_number: 1, week_focus: "Hypertrophy — volume focus", days: week1Days },
        { week_number: 2, week_focus: "Hypertrophy — progressive overload", days: week1Days },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("rejects plan with 0 weeks", () => {
    const plan = {
      split_type: "ppl",
      narrative: "Empty plan",
      risks: [],
      plan_config: {},
      weeks: [],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("rejects week with wrong number of days (not 7)", () => {
    const plan = {
      split_type: "ppl",
      narrative: "Short week",
      risks: [],
      plan_config: {},
      weeks: [
        {
          week_number: 1,
          week_focus: "Build",
          days: [
            { day_label: "Mon", am_session: "Push", am_rationale: null, pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Tue", am_session: "Pull", am_rationale: null, pm_session: null, pm_rationale: null, is_rest: false, notes: null },
          ],
        },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("rejects invalid day_label", () => {
    const days = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sunday"] as string[]).map((day_label) => ({
      day_label,
      am_session: null,
      am_rationale: null,
      pm_session: null,
      pm_rationale: null,
      is_rest: day_label === "Sunday",
      notes: null,
    }));

    const plan = {
      split_type: "ppl",
      narrative: "Invalid day label test",
      risks: [],
      plan_config: {},
      weeks: [
        { week_number: 1, week_focus: "Test week", days },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});

describe("dayLayoutSchema with targets", () => {
  it("validates a cardio day with full targets", () => {
    const day = {
      day_of_week: 1,
      session_type: "Tempo Run",
      ai_notes: "Run at lactate threshold pace",
      targets: {
        target_distance_km: 8,
        target_duration_min: 48,
        target_pace_min_km: 6.0,
        target_hr_zone: 4,
        target_hr_max: 170,
        muscle_focus: null,
      },
    };

    const result = dayLayoutSchema.safeParse(day);
    expect(result.success).toBe(true);
  });

  it("validates a rest day with no targets", () => {
    const day = {
      day_of_week: 6,
      session_type: "Rest",
      ai_notes: null,
    };

    const result = dayLayoutSchema.safeParse(day);
    expect(result.success).toBe(true);
  });

  it("validates a lifting day with muscle_focus set", () => {
    const day = {
      day_of_week: 0,
      session_type: "Push",
      ai_notes: null,
      targets: {
        muscle_focus: "chest, shoulders, triceps",
      },
    };

    const result = dayLayoutSchema.safeParse(day);
    expect(result.success).toBe(true);
  });

  it("validates a day with targets containing nullable fields set to null", () => {
    const day = {
      day_of_week: 3,
      session_type: "Easy Run (Zone 2)",
      ai_notes: null,
      targets: {
        target_distance_km: null,
        target_duration_min: 45,
        target_pace_min_km: null,
        target_hr_zone: 2,
        target_hr_max: null,
        muscle_focus: null,
      },
    };

    const result = dayLayoutSchema.safeParse(day);
    expect(result.success).toBe(true);
  });
});
