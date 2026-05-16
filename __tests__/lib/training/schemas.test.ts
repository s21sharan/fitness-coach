import { describe, it, expect } from "vitest";
import {
  planGenerationSchema,
  dayLayoutSchema,
  workoutTargetsSchema,
  multiWeekPlanSchema,
  workoutContractSchema,
  sessionContractSchema,
  type PlanGeneration,
  type WorkoutTargets,
  type SessionContract,
} from "@/lib/training/schemas";

function makeSession(opts: { sport: SessionContract["sport"]; name: string; rationale?: string | null; slot?: "am" | "pm" | "full"; }): SessionContract {
  return {
    sport: opts.sport,
    name: opts.name,
    rationale: opts.rationale ?? null,
    contract: {
      version: 1,
      sport: opts.sport,
      name: opts.name,
      slot: opts.slot ?? "full",
      source: "coach",
      steps: [
        { type: "work", label: opts.name, duration_sec: 1800, target_hr_zone: 2 },
      ],
    },
  };
}

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

  it("rejects invalid split type", () => {
    const plan = { split_type: "invalid_split", reasoning: "test", weekly_layout: [], plan_config: {} };
    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("requires exactly 7 days in weekly_layout", () => {
    const plan = {
      split_type: "ppl",
      reasoning: "test",
      weekly_layout: [{ day_of_week: 0, session_type: "Push", ai_notes: null }],
      plan_config: {},
    };
    expect(planGenerationSchema.safeParse(plan).success).toBe(false);
  });
});

describe("workoutContractSchema", () => {
  it("validates a cardio contract with warmup/work/cooldown", () => {
    const contract = {
      version: 1,
      sport: "run",
      name: "Easy Z2 run",
      slot: "am",
      source: "coach",
      steps: [
        { type: "warmup", label: "Warm-up", duration_sec: 600, target_hr_zone: 1 },
        { type: "work", label: "Easy run", duration_sec: 2400, target_hr_zone: 2 },
        { type: "cooldown", label: "Cool down", duration_sec: 300, target_hr_zone: 1 },
      ],
    };
    expect(workoutContractSchema.safeParse(contract).success).toBe(true);
  });

  it("validates a strength contract with exercise_name / sets / reps", () => {
    const contract = {
      version: 1,
      sport: "strength",
      name: "Lower body lift",
      slot: "pm",
      source: "coach",
      steps: [
        { type: "work", exercise_name: "Back Squat", sets: 4, reps: 6, rpe: 8 },
        { type: "work", exercise_name: "Romanian Deadlift", sets: 3, reps: 10, rpe: 7 },
        { type: "work", exercise_name: "Leg Press", sets: 3, reps: 12 },
      ],
    };
    expect(workoutContractSchema.safeParse(contract).success).toBe(true);
  });

  it("accepts an interval repeat block", () => {
    const contract = {
      version: 1,
      sport: "run",
      name: "Intervals",
      source: "coach",
      steps: [
        {
          type: "repeat",
          repeats: 6,
          steps: [
            { type: "work", duration_sec: 240, target_hr_zone: 4 },
            { type: "recovery", duration_sec: 90, target_hr_zone: 1 },
          ],
        },
      ],
    };
    expect(workoutContractSchema.safeParse(contract).success).toBe(true);
  });

  it("rejects version != 1", () => {
    expect(
      workoutContractSchema.safeParse({ version: 2, sport: "run", name: "X", source: "coach", steps: [{ type: "work", duration_sec: 60 }] }).success
    ).toBe(false);
  });

  it("rejects HR zone outside 1..5", () => {
    expect(
      workoutContractSchema.safeParse({
        version: 1, sport: "run", name: "X", source: "coach",
        steps: [{ type: "work", duration_sec: 60, target_hr_zone: 7 }],
      }).success
    ).toBe(false);
  });
});

describe("sessionContractSchema", () => {
  it("validates a session referencing a contract", () => {
    const session = makeSession({ sport: "run", name: "Easy run" });
    expect(sessionContractSchema.safeParse(session).success).toBe(true);
  });

  it("requires inner contract", () => {
    expect(
      sessionContractSchema.safeParse({ sport: "run", name: "X" }).success
    ).toBe(false);
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
    expect(workoutTargetsSchema.safeParse(targets).success).toBe(true);
  });

  it("validates targets with contract embedded", () => {
    const targets: WorkoutTargets = {
      contract: {
        version: 1, sport: "run", name: "Easy run", source: "coach",
        steps: [{ type: "work", duration_sec: 1800, target_hr_zone: 2 }],
      },
      target_duration_min: 30,
    };
    expect(workoutTargetsSchema.safeParse(targets).success).toBe(true);
  });

  it("validates empty targets object (all fields optional)", () => {
    expect(workoutTargetsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects target_hr_zone outside 1-5 range", () => {
    expect(workoutTargetsSchema.safeParse({ target_hr_zone: 6 }).success).toBe(false);
  });
});

describe("multiWeekPlanSchema", () => {
  it("validates a 2-week hybrid plan with structured AM/PM sessions", () => {
    const week1Days = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d, i) => ({
      day_label: d,
      am_session: i === 2 || i === 6 ? null : makeSession({ sport: i % 2 === 0 ? "strength" : "run", name: i % 2 === 0 ? "Upper push" : "Easy Z2 run", slot: "am" }),
      pm_session: null,
      is_rest: i === 2 || i === 6,
      notes: null,
    }));
    const plan = {
      split_type: "hybrid_nick_bare",
      narrative: "Hybrid 2 weeks.",
      risks: ["fatigue"],
      plan_config: { periodization_phase: "build", race_weeks_out: 16, deload_frequency: 4 },
      weeks: [
        { week_number: 1, week_focus: "Base", days: week1Days },
        { week_number: 2, week_focus: "Progress", days: week1Days },
      ],
    };
    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("rejects plan with 0 weeks", () => {
    const plan = { split_type: "ppl", narrative: "Empty plan", risks: [], plan_config: {}, weeks: [] };
    expect(multiWeekPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects week with wrong number of days", () => {
    const plan = {
      split_type: "ppl",
      narrative: "Short week",
      risks: [],
      plan_config: {},
      weeks: [{
        week_number: 1,
        week_focus: "Build",
        days: [{ day_label: "Mon", am_session: null, pm_session: null, is_rest: true, notes: null }],
      }],
    };
    expect(multiWeekPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("rejects invalid day_label", () => {
    const days = (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sunday"] as string[]).map((day_label) => ({
      day_label,
      am_session: null,
      pm_session: null,
      is_rest: true,
      notes: null,
    }));
    const plan = {
      split_type: "ppl",
      narrative: "Invalid day label",
      risks: [],
      plan_config: {},
      weeks: [{ week_number: 1, week_focus: "Test", days }],
    };
    expect(multiWeekPlanSchema.safeParse(plan).success).toBe(false);
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
    expect(dayLayoutSchema.safeParse(day).success).toBe(true);
  });

  it("validates a rest day with no targets", () => {
    const day = { day_of_week: 6, session_type: "Rest", ai_notes: null };
    expect(dayLayoutSchema.safeParse(day).success).toBe(true);
  });
});
