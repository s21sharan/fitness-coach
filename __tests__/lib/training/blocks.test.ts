import { describe, it, expect } from "vitest";
import { computeBlockCompliance, computeBlockWeekNumber } from "@/lib/training/blocks";

describe("computeBlockCompliance", () => {
  it("calculates completion percentage from workouts", () => {
    const workouts = [
      { session_type: "Push", status: "completed" },
      { session_type: "Pull", status: "completed" },
      { session_type: "Easy Run", status: "skipped" },
      { session_type: "Rest", status: "scheduled" },
      { session_type: "Legs", status: "completed" },
    ];
    const result = computeBlockCompliance(workouts);
    expect(result.total).toBe(4);
    expect(result.completed).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.pct).toBe(75);
  });

  it("returns 0% for empty workouts", () => {
    const result = computeBlockCompliance([]);
    expect(result.pct).toBe(0);
    expect(result.total).toBe(0);
  });

  it("returns 100% when all non-rest sessions completed", () => {
    const workouts = [
      { session_type: "Push", status: "completed" },
      { session_type: "Rest", status: "scheduled" },
    ];
    const result = computeBlockCompliance(workouts);
    expect(result.pct).toBe(100);
  });
});

describe("computeBlockWeekNumber", () => {
  it("returns 1 for a date on the block start_date", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-01")).toBe(1);
  });

  it("returns 2 for a date in the second week", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-09")).toBe(2);
  });

  it("returns the correct week for mid-block dates", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-20")).toBe(3);
  });
});
