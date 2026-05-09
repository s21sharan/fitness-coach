import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekStrip } from "@/components/plan/week-strip";

describe("WeekStrip", () => {
  const baseDays = [
    { day: "Mon", date: "May 4", label: "Push", type: "lift" as const, duration: "—", exercises: [], done: false, active: false, color: "coral" as const },
    { day: "Tue", date: "May 5", label: "Pull", type: "lift" as const, duration: "—", exercises: [], done: false, active: false, color: "coral" as const },
    { day: "Wed", date: "May 6", label: "Legs", type: "lift" as const, duration: "—", exercises: [], done: false, active: false, color: "coral" as const },
    { day: "Thu", date: "May 7", label: "Rest", type: "rest" as const, duration: "—", exercises: [], done: false, active: false, color: "lemon" as const },
    { day: "Fri", date: "May 8", label: "Push", type: "lift" as const, duration: "—", exercises: [], done: false, active: true, color: "coral" as const },
    { day: "Sat", date: "May 9", label: "Pull", type: "lift" as const, duration: "—", exercises: [], done: false, active: false, color: "coral" as const },
    { day: "Sun", date: "May 10", label: "Rest", type: "rest" as const, duration: "—", exercises: [], done: false, active: false, color: "lemon" as const },
  ];

  it("renders 7 day cards", () => {
    render(<WeekStrip days={baseDays} />);
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Sun")).toBeDefined();
    expect(screen.getAllByText("Push")).toHaveLength(2);
  });

  it("marks today correctly", () => {
    render(<WeekStrip days={baseDays} />);
    expect(screen.getByText("TODAY")).toBeDefined();
  });
});
