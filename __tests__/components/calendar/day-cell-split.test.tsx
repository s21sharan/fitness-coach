import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { splitAmPmSessions } from "@/components/calendar/planned-card";
import { DayCell } from "@/components/calendar/day-cell";
import type { DayData } from "@/lib/training/calendar-data";

/* ─── splitAmPmSessions unit tests ─── */

describe("splitAmPmSessions", () => {
  it("returns single entry for non-AM/PM session", () => {
    const result = splitAmPmSessions("Push Day", "Focus on chest", null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      slot: null,
      label: "Push Day",
      aiNotes: "Focus on chest",
      targets: null,
    });
  });

  it("splits combined AM/PM session into two entries", () => {
    const result = splitAmPmSessions("AM: Easy Run · PM: Push", null, null);
    expect(result).toHaveLength(2);
    expect(result[0].slot).toBe("am");
    expect(result[0].label).toBe("Easy Run");
    expect(result[1].slot).toBe("pm");
    expect(result[1].label).toBe("Push");
  });

  it("splits AI notes by AM/PM markers", () => {
    const notes = "AM — Keep it aerobic\nPM — Heavy compound lifts";
    const result = splitAmPmSessions("AM: Easy Run · PM: Push", notes, null);
    expect(result[0].aiNotes).toBe("Keep it aerobic");
    expect(result[1].aiNotes).toBe("Heavy compound lifts");
  });

  it("assigns same notes to both when no AM/PM markers in notes", () => {
    const result = splitAmPmSessions("AM: Easy Run · PM: Push", "Stay hydrated", null);
    expect(result[0].aiNotes).toBe("Stay hydrated");
    expect(result[1].aiNotes).toBe("Stay hydrated");
  });
});

/* ─── DayCell rendering tests ─── */

function makeDayData(overrides: Partial<DayData> = {}): DayData {
  return {
    date: "2026-06-15",
    dateObj: new Date(2026, 5, 15),
    workouts: [],
    cardio: [],
    recovery: null,
    planned: null,
    ...overrides,
  };
}

const defaultUnits = { distance: "km" as const, weight: "kg" as const, swimDistance: "m" as const };

describe("DayCell — AM/PM card splitting", () => {
  it("renders two separate PlannedCards in tall view for AM/PM session", () => {
    const day = makeDayData({
      date: "2026-06-15",
      planned: {
        id: "p1",
        date: "2026-06-15",
        day_of_week: 1,
        session_type: "AM: Easy Run · PM: Push",
        ai_notes: null,
        targets: null,
        approved: true,
        status: "pending",
        skip_reason: null,
        completion_note: null,
      },
    });

    render(<DayCell day={day} variant="tall" units={defaultUnits} />);

    // Should see two separate labels, not the combined string
    expect(screen.getByText("Easy Run")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.queryByText("AM: Easy Run · PM: Push")).toBeNull();

    // Both should have "Planned" tags
    const plannedTags = screen.getAllByText("Planned");
    expect(plannedTags).toHaveLength(2);

    // Should show AM/PM slot labels
    expect(screen.getByText("am")).toBeDefined();
    expect(screen.getByText("pm")).toBeDefined();
  });

  it("renders single PlannedCard in tall view for non-AM/PM session", () => {
    const day = makeDayData({
      date: "2026-06-15",
      planned: {
        id: "p2",
        date: "2026-06-15",
        day_of_week: 1,
        session_type: "Long Run",
        ai_notes: null,
        targets: null,
        approved: true,
        status: "pending",
        skip_reason: null,
        completion_note: null,
      },
    });

    render(<DayCell day={day} variant="tall" units={defaultUnits} />);

    expect(screen.getByText("Long Run")).toBeDefined();
    expect(screen.getAllByText("Planned")).toHaveLength(1);
  });

  it("renders two separate PlannedPills in compact view for AM/PM session", () => {
    const day = makeDayData({
      date: "2026-06-15",
      planned: {
        id: "p3",
        date: "2026-06-15",
        day_of_week: 1,
        session_type: "AM: Easy Run · PM: Push",
        ai_notes: null,
        targets: null,
        approved: true,
        status: "pending",
        skip_reason: null,
        completion_note: null,
      },
    });

    render(<DayCell day={day} variant="compact" units={defaultUnits} />);

    // Should see two separate labels
    expect(screen.getByText("Easy Run")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.queryByText("AM: Easy Run · PM: Push")).toBeNull();
  });

  it("renders single PlannedPill in compact view for non-AM/PM session", () => {
    const day = makeDayData({
      date: "2026-06-15",
      planned: {
        id: "p4",
        date: "2026-06-15",
        day_of_week: 1,
        session_type: "Rest Day",
        ai_notes: null,
        targets: null,
        approved: true,
        status: "pending",
        skip_reason: null,
        completion_note: null,
      },
    });

    render(<DayCell day={day} variant="compact" units={defaultUnits} />);

    expect(screen.getByText("Rest Day")).toBeDefined();
  });
});
