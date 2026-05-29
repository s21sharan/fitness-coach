import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RaceCountdownStrip } from "@/components/dashboard/race-countdown-strip";

describe("RaceCountdownStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Use noon UTC so local-time date components agree with the calendar date
    vi.setSystemTime(new Date("2026-05-19T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when events is empty", () => {
    const { container } = render(<RaceCountdownStrip events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders up to 3 pills from 4 events", () => {
    const events = [
      { id: "1", name: "Race 1", event_date: "2026-06-01", priority: "A" },
      { id: "2", name: "Race 2", event_date: "2026-07-01", priority: "B" },
      { id: "3", name: "Race 3", event_date: "2026-08-01", priority: "C" },
      { id: "4", name: "Race 4", event_date: "2026-09-01", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    // Only first 3 should appear
    expect(screen.getByText("Race 1")).toBeDefined();
    expect(screen.getByText("Race 2")).toBeDefined();
    expect(screen.getByText("Race 3")).toBeDefined();
    expect(screen.queryByText("Race 4")).toBeNull();
  });

  it("shows correct day countdown", () => {
    const events = [
      // 2026-05-26 is 7 days after 2026-05-19
      { id: "1", name: "Test Race", event_date: "2026-05-26", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    expect(screen.getByText("7d")).toBeDefined();
  });

  it("shows 'Today' for same-day events", () => {
    const events = [
      { id: "1", name: "Same Day Race", event_date: "2026-05-19", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    expect(screen.getByText("Today")).toBeDefined();
  });

  it("applies urgency styling (red background) for events <= 7 days away", () => {
    const events = [
      { id: "1", name: "Urgent Race", event_date: "2026-05-25", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    const badge = screen.getByText("6d");
    expect(badge).toBeDefined();
    // jsdom normalizes hex colors to rgb() format
    expect(badge.style.background).toBe("rgb(254, 242, 242)");
    expect(badge.style.color).toBe("rgb(220, 38, 38)");
  });

  it("applies default styling for events > 7 days away", () => {
    const events = [
      { id: "1", name: "Future Race", event_date: "2026-06-01", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    const badge = screen.getByText("13d");
    expect(badge).toBeDefined();
    expect(badge.style.background).toBe("rgb(243, 244, 246)");
    expect(badge.style.color).toBe("rgb(55, 65, 81)");
  });

  it("shows priority letter A with coral background", () => {
    const events = [
      { id: "1", name: "A Race", event_date: "2026-06-15", priority: "A" },
    ];
    render(<RaceCountdownStrip events={events} />);
    const dot = screen.getByText("A");
    expect(dot).toBeDefined();
    expect(dot.style.background).toBe("rgb(248, 113, 113)");
  });

  it("shows priority letter B with amber background", () => {
    const events = [
      { id: "1", name: "B Race", event_date: "2026-06-15", priority: "B" },
    ];
    render(<RaceCountdownStrip events={events} />);
    const dot = screen.getByText("B");
    expect(dot).toBeDefined();
    expect(dot.style.background).toBe("rgb(251, 191, 36)");
  });

  it("shows priority letter C with gray background", () => {
    const events = [
      { id: "1", name: "C Race", event_date: "2026-06-15", priority: "C" },
    ];
    render(<RaceCountdownStrip events={events} />);
    const dot = screen.getByText("C");
    expect(dot).toBeDefined();
    expect(dot.style.background).toBe("rgb(156, 163, 175)");
  });

  it("does not show priority dot when priority is null", () => {
    const events = [
      { id: "1", name: "No Priority Race", event_date: "2026-06-15", priority: null },
    ];
    render(<RaceCountdownStrip events={events} />);
    // No A, B, or C text should be present
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText("B")).toBeNull();
    expect(screen.queryByText("C")).toBeNull();
  });
});
