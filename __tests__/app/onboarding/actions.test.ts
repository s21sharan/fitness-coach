import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    from: (table: string) => ({
      upsert: mockUpsert,
      update: mockUpdate,
    }),
  }),
}));

describe("saveOnboardingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves profile and goals to Supabase", async () => {
    const { saveOnboardingData } = await import("@/app/onboarding/actions");

    const result = await saveOnboardingData({
      height: 178,
      weight: 175,
      age: 25,
      sex: "M",
      bodyGoal: "gain_muscle",
      bodyGoalOther: "",
      emphasis: "shoulders",
      trainingForRace: false,
      raceType: null,
      raceTypeOther: "",
      raceDate: null,
      goalTime: null,
      doesCardio: true,
      cardioTypes: ["running"],
      experience: "intermediate",
      daysPerWeek: 5,
      liftingDays: 5,
    });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
