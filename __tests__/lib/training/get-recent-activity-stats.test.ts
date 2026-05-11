import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js before importing the module under test
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { getRecentActivityStats } from "@/lib/training/generate-plan";

function makeSupabaseMock(data: {
  cardio?: object[];
  workouts?: object[];
  recovery?: object[];
}) {
  const makeChain = (rows: object[]) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    return chain;
  };

  const mockFrom = vi.fn((table: string) => {
    if (table === "cardio_logs") return makeChain(data.cardio ?? []);
    if (table === "workout_logs") return makeChain(data.workouts ?? []);
    if (table === "recovery_logs") return makeChain(data.recovery ?? []);
    return makeChain([]);
  });

  return { from: mockFrom };
}

describe("getRecentActivityStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns null when no activity data exists", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({}));

    const result = await getRecentActivityStats("user-123");
    expect(result).toBeNull();
  });

  it("returns stats with run metrics when cardio data exists", async () => {
    const cardio = [
      { type: "run", distance: 10, duration: 3000, avg_hr: 150 },
      { type: "run", distance: 8, duration: 2400, avg_hr: 145 },
    ];
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({ cardio }));

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.weeklyRunCount).toBeGreaterThan(0);
    expect(result!.avgRunDistanceKm).toBe(9);
    expect(result!.avgRunHr).toBe(148);
  });

  it("returns null avgRunPaceMinKm when no runs with distance", async () => {
    const cardio = [{ type: "bike", distance: 30, duration: 3600, avg_hr: 130 }];
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({ cardio }));

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.avgRunPaceMinKm).toBeNull();
    expect(result!.weeklyRunCount).toBe(0);
  });

  it("returns lift stats from workout logs", async () => {
    const workouts = [
      { duration_minutes: 60 },
      { duration_minutes: 45 },
      { duration_minutes: 75 },
    ];
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({ workouts }));

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.weeklyLiftCount).toBeGreaterThan(0);
    expect(result!.avgLiftDurationMin).toBe(60);
  });

  it("returns HRV and sleep stats from recovery logs", async () => {
    const recovery = [
      { hrv: 50, sleep_hours: 7.5 },
      { hrv: 60, sleep_hours: 8 },
      { hrv: null, sleep_hours: 6.5 },
    ];
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({ recovery }));

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.avgHrv).toBe(55);
    expect(result!.avgSleepHours).toBe(7.3);
  });

  it("handles mixed data across all three tables", async () => {
    const cardio = [{ type: "run", distance: 5, duration: 1500, avg_hr: 160 }];
    const workouts = [{ duration_minutes: 50 }];
    const recovery = [{ hrv: 45, sleep_hours: 7 }];

    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSupabaseMock({ cardio, workouts, recovery }),
    );

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.weeklyRunCount).toBeGreaterThan(0);
    expect(result!.weeklyLiftCount).toBeGreaterThan(0);
    expect(result!.avgHrv).toBe(45);
  });

  it("returns null avgHrv when no hrv values present", async () => {
    const recovery = [{ hrv: null, sleep_hours: 8 }];
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(makeSupabaseMock({ recovery }));

    const result = await getRecentActivityStats("user-123");
    expect(result).not.toBeNull();
    expect(result!.avgHrv).toBeNull();
    expect(result!.avgSleepHours).toBe(8);
  });
});
