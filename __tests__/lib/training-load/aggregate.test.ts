import { describe, it, expect } from "vitest";
import { aggregateAthleteLoad } from "@/lib/training-load/aggregate";

interface MockResult<T> {
  data: T;
  error: null;
}

function fakeSupabase(data: {
  cardio?: unknown[];
  workouts?: unknown[];
  recovery?: unknown[];
  nutrition?: unknown[];
}) {
  const mk = <T>(rows: T[]): MockResult<T[]> => ({ data: rows, error: null });

  function chain<T>(rows: T[]) {
    const result: MockResult<T[]> = mk(rows);
    const builder: Record<string, (...args: unknown[]) => unknown> = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      order: () => builder,
      returns: () => builder,
      // promise-like
      then: (resolve: (v: MockResult<T[]>) => void) => resolve(result),
    };
    return builder;
  }

  return {
    from: (table: string) => {
      switch (table) {
        case "cardio_logs":
          return chain(data.cardio ?? []);
        case "workout_logs":
          return chain(data.workouts ?? []);
        case "recovery_logs":
          return chain(data.recovery ?? []);
        case "nutrition_logs":
          return chain(data.nutrition ?? []);
        default:
          return chain([]);
      }
    },
  };
}

describe("aggregateAthleteLoad", () => {
  it("returns hasAnyData=false when nothing synced", async () => {
    const supa = fakeSupabase({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await aggregateAthleteLoad(supa as any, "user-1");
    expect(result.hasAnyData).toBe(false);
    expect(result.run).toBeNull();
    expect(result.bike).toBeNull();
  });

  it("aggregates run miles from cardio_logs", async () => {
    const today = new Date();
    const isoDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      return d.toISOString().slice(0, 10);
    });
    const cardio = isoDays.map((date) => ({
      date,
      type: "run",
      distance: 10,    // km -> 6.21 mi
      duration: 60 * 60,
    }));
    const supa = fakeSupabase({ cardio });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await aggregateAthleteLoad(supa as any, "user-1");
    expect(result.run).not.toBeNull();
    expect(result.run?.unit).toBe("miles");
    expect(result.run?.weeks_observed).toBeGreaterThanOrEqual(1);
    expect(result.run?.longest_session).toBeGreaterThan(0);
    expect(result.hasAnyData).toBe(true);
  });

  it("aggregates lifting sessions from workout_logs", async () => {
    const today = new Date();
    const workouts = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      return { date: d.toISOString().slice(0, 10), duration_minutes: 60 };
    });
    const supa = fakeSupabase({ workouts });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await aggregateAthleteLoad(supa as any, "user-1");
    expect(result.lift).not.toBeNull();
    expect(result.lift?.unit).toBe("sessions");
  });

  it("summarizes recovery averages", async () => {
    const today = new Date();
    const day = (offset: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - offset);
      return d.toISOString().slice(0, 10);
    };

    const recovery = [
      { date: day(0), sleep_hours: 8, hrv: 60, resting_hr: 52 },
      { date: day(1), sleep_hours: 7, hrv: 55, resting_hr: 54 },
    ];

    const supa = fakeSupabase({ recovery });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await aggregateAthleteLoad(supa as any, "user-1");
    expect(result.recovery?.avg_sleep_hours).toBe(7.5);
    expect(result.recovery?.avg_hrv).toBe(58);
  });
});
