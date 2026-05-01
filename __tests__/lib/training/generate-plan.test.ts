import { describe, it, expect } from "vitest";
import { generatePlannedWorkouts } from "@/lib/training/generate-plan";
import type { DayLayout } from "@/lib/training/schemas";

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
