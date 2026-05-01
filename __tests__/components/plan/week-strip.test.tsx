import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekStrip } from "@/components/plan/week-strip";

describe("WeekStrip", () => {
  const baseWorkouts = [
    { id: "1", date: "2026-05-04", day_of_week: 0, session_type: "Push", ai_notes: null, status: "scheduled", approved: true },
    { id: "2", date: "2026-05-05", day_of_week: 1, session_type: "Pull", ai_notes: null, status: "scheduled", approved: true },
    { id: "3", date: "2026-05-06", day_of_week: 2, session_type: "Legs", ai_notes: null, status: "scheduled", approved: true },
    { id: "4", date: "2026-05-07", day_of_week: 3, session_type: "Rest", ai_notes: null, status: "scheduled", approved: true },
    { id: "5", date: "2026-05-08", day_of_week: 4, session_type: "Push", ai_notes: null, status: "scheduled", approved: true },
    { id: "6", date: "2026-05-09", day_of_week: 5, session_type: "Pull", ai_notes: null, status: "scheduled", approved: true },
    { id: "7", date: "2026-05-10", day_of_week: 6, session_type: "Rest", ai_notes: null, status: "scheduled", approved: true },
  ];

  it("renders 7 day cards", () => {
    render(<WeekStrip workouts={baseWorkouts} completions={{}} weekStart="2026-05-04" today="2026-05-08" />);
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Sun")).toBeDefined();
    expect(screen.getAllByText("Push")).toHaveLength(2);
  });

  it("marks today correctly", () => {
    render(<WeekStrip workouts={baseWorkouts} completions={{}} weekStart="2026-05-04" today="2026-05-08" />);
    expect(screen.getByText("Today")).toBeDefined();
  });
});
