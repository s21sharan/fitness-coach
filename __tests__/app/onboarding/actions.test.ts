import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  type AthleteContextProfile,
  getDefaultAthleteProfile,
} from "@/lib/onboarding/types";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-1" })),
}));

// Track calls per table
const tableCalls: Record<string, { method: string; args: unknown }[]> = {};

function record(table: string, method: string, args: unknown) {
  if (!tableCalls[table]) tableCalls[table] = [];
  tableCalls[table].push({ method, args });
}

const mockSupabase = {
  from: (table: string) => {
    return {
      upsert: (args: unknown) => {
        record(table, "upsert", args);
        return Promise.resolve({ error: null });
      },
      insert: (args: unknown) => {
        record(table, "insert", args);
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        eq: () => {
          record(table, "delete", {});
          return Promise.resolve({ error: null });
        },
      }),
      update: (args: unknown) => ({
        eq: () => {
          record(table, "update", args);
          return Promise.resolve({ error: null });
        },
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => mockSupabase,
}));

vi.mock("@/lib/training-load/aggregate", () => ({
  aggregateAthleteLoad: vi.fn(() =>
    Promise.resolve({
      windowDays: 56,
      run: null,
      bike: null,
      swim: null,
      lift: null,
      nutrition: null,
      recovery: null,
      hasAnyData: false,
    })
  ),
}));

beforeEach(() => {
  for (const k of Object.keys(tableCalls)) delete tableCalls[k];
});

describe("saveOnboardingDraft", () => {
  it("upserts the payload to onboarding_drafts", async () => {
    const { saveOnboardingDraft } = await import("@/app/onboarding/actions");
    const res = await saveOnboardingDraft(getDefaultAthleteProfile(), "welcome");
    expect(res.success).toBe(true);
    expect(tableCalls.onboarding_drafts?.[0].method).toBe("upsert");
    const args = tableCalls.onboarding_drafts[0].args as Record<string, unknown>;
    expect(args.user_id).toBe("test-user-1");
    expect(args.current_step).toBe("welcome");
  });
});

describe("getOnboardingDraft", () => {
  it("returns null profile when no draft exists", async () => {
    const { getOnboardingDraft } = await import("@/app/onboarding/actions");
    const res = await getOnboardingDraft();
    expect(res.success).toBe(true);
    expect(res.profile).toBe(null);
  });
});

describe("commitOnboardingData", () => {
  it("writes to all normalized tables and flips onboarding_completed", async () => {
    const { commitOnboardingData } = await import("@/app/onboarding/actions");
    const profile: AthleteContextProfile = {
      ...getDefaultAthleteProfile(),
      basic: { height_cm: 178, weight_lbs: 180, age: 30, sex: "M", training_experience: "intermediate" },
      athlete_identity: "hybrid_athlete",
      goal_keys: ["build_aerobic_base", "build_muscle"],
      goal_rank: ["build_aerobic_base", "build_muscle"],
      primary_optimization: "general_fitness",
      aggressiveness: "balanced",
      sports: {
        ...getDefaultAthleteProfile().sports,
        run: { ...getDefaultAthleteProfile().sports.run, enabled: true, is_planned: true, is_primary: true, target_peak: { weekly_miles: 30 } },
        lift: { ...getDefaultAthleteProfile().sports.lift, enabled: true, is_planned: true, target_peak: { weekly_sessions: 3 } },
      },
      events: [
        {
          id: "e1",
          name: "Test 10K",
          sport_type: "running",
          distance: "10K",
          event_date: "2026-09-01",
          priority: "B",
          goal_type: "pr",
          goal_time: "42:00",
          course_notes: null,
          travel: false,
        },
      ],
      availability_windows: [
        { id: "w1", day_of_week: 0, start_time: "06:00", end_time: "08:00", max_duration_min: 60, locations: ["gym"] },
      ],
      availability_rules: [
        { id: "r1", rule_key: "long_run_weekend", params: null },
      ],
      injuries: [
        { id: "i1", area: "knee", current_pain_level: 2, history: true, triggers: ["hills"], affecting_training: false },
      ],
      equipment: [
        { id: "eq1", sport: "lift", item: "barbell", available: true },
      ],
      body_nutrition: {
        ...getDefaultAthleteProfile().body_nutrition,
        body_goal: "recomp",
        protein_target_g: 180,
      },
      preferences: {
        motivation_drivers: ["seeing_progress"],
        common_derailers: ["travel"],
        enjoyed_workouts: ["long_runs"],
        dislikes: [],
        sacrifice_priority: ["reduce_accessories"],
        protect_priority: ["long_run"],
      },
      coach: {
        aggressiveness: "balanced",
        explanation_level: "moderate",
        missed_workout_behavior: "ask_first",
        plan_flexibility: "somewhat_flexible",
        tone_notes: "direct",
      },
    };

    const res = await commitOnboardingData(profile);
    expect(res.success).toBe(true);

    // All expected tables touched
    for (const table of [
      "user_profiles",
      "user_goals",
      "athlete_sports",
      "athlete_events",
      "athlete_availability_windows",
      "athlete_availability_rules",
      "athlete_recovery",
      "athlete_injuries",
      "athlete_equipment",
      "athlete_body_nutrition",
      "athlete_preferences",
      "athlete_coach_settings",
      "athlete_derived_scores",
      "users",
      "onboarding_drafts",
    ]) {
      expect(tableCalls[table], `expected ${table} to be touched`).toBeDefined();
    }

    // Users table flipped to onboarding_completed=true
    const userUpdate = tableCalls.users.find((c) => c.method === "update");
    expect((userUpdate?.args as Record<string, unknown>)?.onboarding_completed).toBe(true);

    // Onboarding_drafts deleted at the end
    const draftDelete = tableCalls.onboarding_drafts.find((c) => c.method === "delete");
    expect(draftDelete).toBeDefined();
  });
});
