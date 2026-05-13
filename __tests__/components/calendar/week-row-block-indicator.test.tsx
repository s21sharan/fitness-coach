import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekRow } from "@/components/calendar/week-row";
import type { DayData } from "@/lib/training/calendar-data";

/** Build a minimal DayData array for a given week Monday */
function makeDays(startDate: string): DayData[] {
  const days: DayData[] = [];
  const d = new Date(startDate + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      date: dateStr,
      dateObj: new Date(dateStr + "T00:00:00"),
      workouts: [],
      cardio: [],
      recovery: null,
      planned: null,
    });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const units = { distance: "km" as const, weight: "kg" as const };

describe("WeekRow block indicator", () => {
  it("does not render block indicator when activeBlock is not provided", () => {
    const days = makeDays("2026-05-04");
    render(
      <WeekRow
        days={days}
        weekNum={19}
        units={units}
      />
    );
    expect(screen.queryByText(/Build/)).toBeNull();
    expect(screen.queryByText(/Wk/)).toBeNull();
  });

  it("renders block indicator when week Monday falls within block date range", () => {
    const days = makeDays("2026-05-04"); // Mon 4 May 2026
    const activeBlock = {
      id: "b1",
      plan_id: "p1",
      block_number: 1,
      block_type: "build" as const,
      block_label: "Build",
      week_count: 4,
      start_date: "2026-04-27",
      end_date: "2026-05-24",
      status: "active" as const,
      generation_context: null,
      created_at: "2026-04-27T00:00:00Z",
    };

    render(
      <WeekRow
        days={days}
        weekNum={19}
        units={units}
        activeBlock={activeBlock}
      />
    );

    // "Build · Wk 2/4" — Mon May 4 is 7 days after Apr 27 → week 2
    expect(screen.getByText("Build · Wk 2/4")).toBeDefined();
  });

  it("does not render block indicator when week Monday is before block start_date", () => {
    const days = makeDays("2026-04-20"); // Mon Apr 20 — before block start Apr 27
    const activeBlock = {
      id: "b1",
      plan_id: "p1",
      block_number: 1,
      block_type: "build" as const,
      block_label: "Build",
      week_count: 4,
      start_date: "2026-04-27",
      end_date: "2026-05-24",
      status: "active" as const,
      generation_context: null,
      created_at: "2026-04-27T00:00:00Z",
    };

    render(
      <WeekRow
        days={days}
        weekNum={17}
        units={units}
        activeBlock={activeBlock}
      />
    );

    expect(screen.queryByText(/Build/)).toBeNull();
  });

  it("does not render block indicator when week Monday is after block end_date", () => {
    const days = makeDays("2026-06-01"); // Mon Jun 1 — after block end May 24
    const activeBlock = {
      id: "b1",
      plan_id: "p1",
      block_number: 1,
      block_type: "build" as const,
      block_label: "Build",
      week_count: 4,
      start_date: "2026-04-27",
      end_date: "2026-05-24",
      status: "active" as const,
      generation_context: null,
      created_at: "2026-04-27T00:00:00Z",
    };

    render(
      <WeekRow
        days={days}
        weekNum={23}
        units={units}
        activeBlock={activeBlock}
      />
    );

    expect(screen.queryByText(/Build/)).toBeNull();
  });

  it("renders block indicator for the first week (Wk 1)", () => {
    const days = makeDays("2026-04-27"); // Mon Apr 27 — same as block start
    const activeBlock = {
      id: "b1",
      plan_id: "p1",
      block_number: 1,
      block_type: "peak" as const,
      block_label: "Peak",
      week_count: 3,
      start_date: "2026-04-27",
      end_date: "2026-05-17",
      status: "active" as const,
      generation_context: null,
      created_at: "2026-04-27T00:00:00Z",
    };

    render(
      <WeekRow
        days={days}
        weekNum={18}
        units={units}
        activeBlock={activeBlock}
      />
    );

    expect(screen.getByText("Peak · Wk 1/3")).toBeDefined();
  });

  it("uses blockTypeLabel to display human-readable block type", () => {
    const days = makeDays("2026-05-04");
    const activeBlock = {
      id: "b2",
      plan_id: "p1",
      block_number: 2,
      block_type: "accumulation" as const,
      block_label: "Accumulation Block",
      week_count: 6,
      start_date: "2026-04-27",
      end_date: "2026-06-07",
      status: "active" as const,
      generation_context: null,
      created_at: "2026-04-27T00:00:00Z",
    };

    render(
      <WeekRow
        days={days}
        weekNum={19}
        units={units}
        activeBlock={activeBlock}
      />
    );

    // Should use blockTypeLabel("accumulation") = "Accumulation"
    expect(screen.getByText("Accumulation · Wk 2/6")).toBeDefined();
  });
});
