import { describe, it, expect } from "vitest";
import { generatePlannedWorkouts, expandBlocksToWorkouts } from "@/lib/training/generate-plan";
import type { DayLayout, SessionContract, WeekBlock } from "@/lib/training/schemas";

function makeSession(over: { sport: SessionContract["sport"]; name: string; rationale?: string | null; slot?: "am" | "pm" | "full"; }): SessionContract {
  return {
    sport: over.sport,
    name: over.name,
    rationale: over.rationale ?? null,
    contract: {
      version: 1,
      sport: over.sport,
      name: over.name,
      slot: over.slot ?? "full",
      source: "coach",
      steps: [
        { type: "work", label: over.name, duration_sec: 1800, target_hr_zone: 2 },
      ],
    },
  };
}

describe("generatePlannedWorkouts", () => {
  it("generates 4 weeks of planned workouts from a weekly layout", () => {
    const layout: DayLayout[] = [
      { day_of_week: 0, session_type: "Push", ai_notes: null },
      { day_of_week: 1, session_type: "Pull", ai_notes: null },
      { day_of_week: 2, session_type: "Legs", ai_notes: null },
      { day_of_week: 3, session_type: "Rest", ai_notes: null },
      { day_of_week: 4, session_type: "Push", ai_notes: null },
      { day_of_week: 5, session_type: "Pull", ai_notes: null },
      { day_of_week: 6, session_type: "Rest", ai_notes: null },
    ];

    const startDate = new Date("2026-05-04"); // a Monday
    const workouts = generatePlannedWorkouts("plan-123", layout, startDate, 4);

    expect(workouts).toHaveLength(28);
    expect(workouts[0].plan_id).toBe("plan-123");
    expect(workouts[0].date).toBe("2026-05-04");
    expect(workouts[0].day_of_week).toBe(0);
    expect(workouts[0].session_type).toBe("Push");
    expect(workouts[0].status).toBe("scheduled");
    expect(workouts[0].approved).toBe(true);

    expect(workouts[7].date).toBe("2026-05-11");
    expect(workouts[7].session_type).toBe("Push");
  });

  it("calculates correct dates for each day of the week", () => {
    const layout: DayLayout[] = [
      { day_of_week: 0, session_type: "Upper", ai_notes: null },
      { day_of_week: 1, session_type: "Rest", ai_notes: null },
      { day_of_week: 2, session_type: "Lower", ai_notes: null },
      { day_of_week: 3, session_type: "Rest", ai_notes: null },
      { day_of_week: 4, session_type: "Upper", ai_notes: null },
      { day_of_week: 5, session_type: "Lower", ai_notes: null },
      { day_of_week: 6, session_type: "Rest", ai_notes: null },
    ];

    const startDate = new Date("2026-05-04");
    const workouts = generatePlannedWorkouts("plan-1", layout, startDate, 1);

    expect(workouts[0].date).toBe("2026-05-04");
    expect(workouts[1].date).toBe("2026-05-05");
    expect(workouts[2].date).toBe("2026-05-06");
    expect(workouts[3].date).toBe("2026-05-07");
    expect(workouts[4].date).toBe("2026-05-08");
    expect(workouts[5].date).toBe("2026-05-09");
    expect(workouts[6].date).toBe("2026-05-10");
  });

  it("preserves ai_notes from layout", () => {
    const layout: DayLayout[] = Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      session_type: i === 0 ? "Push" : "Rest",
      ai_notes: i === 0 ? "Go heavy today" : null,
    }));

    const workouts = generatePlannedWorkouts("plan-1", layout, new Date("2026-05-04"), 1);
    expect(workouts[0].ai_notes).toBe("Go heavy today");
    expect(workouts[1].ai_notes).toBeNull();
  });
});

describe("expandBlocksToWorkouts", () => {
  it("converts multi-week structured blocks to planned_workout rows", () => {
    const blocks: WeekBlock[] = [
      {
        week_number: 1,
        week_focus: "Base week",
        days: [
          { day_label: "Mon", am_session: makeSession({ sport: "run", name: "Easy Z2 run", rationale: "Aerobic base", slot: "am" }), pm_session: makeSession({ sport: "strength", name: "Upper push/pull", rationale: "Strength", slot: "pm" }), is_rest: false, notes: null },
          { day_label: "Tue", am_session: null, pm_session: null, is_rest: true, notes: "Rest" },
          { day_label: "Wed", am_session: null, pm_session: makeSession({ sport: "strength", name: "Lower squat focus", rationale: "Leg day", slot: "pm" }), is_rest: false, notes: null },
          { day_label: "Thu", am_session: makeSession({ sport: "run", name: "Tempo run", rationale: "Quality", slot: "am" }), pm_session: null, is_rest: false, notes: null },
          { day_label: "Fri", am_session: null, pm_session: null, is_rest: true, notes: "Rest" },
          { day_label: "Sat", am_session: makeSession({ sport: "run", name: "Long run", rationale: "Long", slot: "am" }), pm_session: null, is_rest: false, notes: null },
          { day_label: "Sun", am_session: null, pm_session: null, is_rest: true, notes: "Full rest" },
        ],
      },
    ];

    const startDate = new Date("2026-05-18"); // Monday
    const workouts = expandBlocksToWorkouts("plan-abc", blocks, startDate);

    expect(workouts).toHaveLength(7);

    // Monday: AM + PM combined
    expect(workouts[0].date).toBe("2026-05-18");
    expect(workouts[0].session_type).toContain("AM:");
    expect(workouts[0].session_type).toContain("PM:");
    expect(workouts[0].ai_notes).toContain("AM");
    const monTargets = workouts[0].targets as Record<string, unknown> | null;
    expect(monTargets).not.toBeNull();
    expect((monTargets as { contract?: { steps: Array<{ label?: string }> } }).contract?.steps.some((s) => s.label?.startsWith("AM —"))).toBe(true);

    // Tuesday: rest
    expect(workouts[1].date).toBe("2026-05-19");
    expect(workouts[1].session_type).toBe("Rest");
    expect(workouts[1].targets).toBeNull();

    // Thursday: AM only — Tempo run
    expect(workouts[3].date).toBe("2026-05-21");
    expect(workouts[3].session_type).toBe("Tempo run");
  });

  it("handles 2-week blocks with correct date progression", () => {
    const restDay = { am_session: null, pm_session: null, is_rest: true, notes: null };
    const activeDay = { am_session: makeSession({ sport: "strength", name: "Push Day", rationale: "Strength" }), pm_session: null, is_rest: false, notes: null };

    const blocks: WeekBlock[] = [
      { week_number: 1, week_focus: "Week 1", days: [
        { day_label: "Mon", ...activeDay }, { day_label: "Tue", ...restDay },
        { day_label: "Wed", ...activeDay }, { day_label: "Thu", ...restDay },
        { day_label: "Fri", ...activeDay }, { day_label: "Sat", ...restDay },
        { day_label: "Sun", ...restDay },
      ]},
      { week_number: 2, week_focus: "Week 2", days: [
        { day_label: "Mon", ...activeDay }, { day_label: "Tue", ...restDay },
        { day_label: "Wed", ...activeDay }, { day_label: "Thu", ...restDay },
        { day_label: "Fri", ...activeDay }, { day_label: "Sat", ...restDay },
        { day_label: "Sun", ...restDay },
      ]},
    ];

    const startDate = new Date("2026-05-18");
    const workouts = expandBlocksToWorkouts("plan-xyz", blocks, startDate);

    expect(workouts).toHaveLength(14);
    expect(workouts[0].date).toBe("2026-05-18"); // Week 1 Monday
    expect(workouts[7].date).toBe("2026-05-25"); // Week 2 Monday
  });

  it("sets approved=true and status=scheduled on all rows", () => {
    const blocks: WeekBlock[] = [{
      week_number: 1,
      week_focus: "test",
      days: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((label) => ({
        day_label: label,
        am_session: null,
        pm_session: null,
        is_rest: true,
        notes: null,
      })),
    }];

    const workouts = expandBlocksToWorkouts("plan-1", blocks, new Date("2026-05-18"));
    for (const w of workouts) {
      expect(w.status).toBe("scheduled");
      expect(w.approved).toBe(true);
    }
  });
});
