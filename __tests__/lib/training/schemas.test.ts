import { describe, it, expect } from "vitest";
import { planGenerationSchema, type PlanGeneration } from "@/lib/training/schemas";

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
