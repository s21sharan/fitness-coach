import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn(() => "mock-model"),
}));

vi.mock("@/lib/training/generate-plan", () => ({
  getRecentActivityStats: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/training/prompts", () => ({
  PLAN_SYSTEM_PROMPT: "system prompt",
  buildUserPrompt: vi.fn().mockReturnValue("user prompt"),
}));

vi.mock("@/lib/training/schemas", () => ({
  planGenerationSchema: {},
}));

import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { NextRequest } from "next/server";

const mockWeeklyLayout = [
  { day_of_week: 0, session_type: "Push", ai_notes: "Go heavy", targets: null },
  { day_of_week: 1, session_type: "Pull", ai_notes: null, targets: null },
  { day_of_week: 2, session_type: "Legs", ai_notes: null, targets: null },
  { day_of_week: 3, session_type: "Rest", ai_notes: null, targets: null },
  { day_of_week: 4, session_type: "Push", ai_notes: null, targets: null },
  { day_of_week: 5, session_type: "Pull", ai_notes: null, targets: null },
  { day_of_week: 6, session_type: "Rest", ai_notes: null, targets: null },
];

function makeRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/plan/regenerate", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const defaults = {
    activePlans: [{ id: "plan-1", user_id: "user-1", split_type: "ppl", body_goal: "gain_muscle", race_type: null, plan_config: {} }],
    existingWorkouts: [],
    profile: { age: 30, height: 180, weight: 180, sex: "M", training_experience: "intermediate" },
    goals: { body_goal: "gain_muscle", emphasis: null, days_per_week: 5, lifting_days: 4, training_for_race: false, race_type: null, race_date: null, goal_time: null, does_cardio: true, cardio_types: ["run"] },
    latestConvo: { id: "convo-1" },
  };

  const data = { ...defaults, ...overrides };

  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const singleMock = vi.fn();

  const fromMock = vi.fn((table: string) => {
    if (table === "training_plans") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: data.activePlans, error: null }),
      };
    }
    if (table === "planned_workouts") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: data.existingWorkouts }),
        insert: insertMock,
      };
    }
    if (table === "user_profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: data.profile }),
      };
    }
    if (table === "user_goals") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: data.goals }),
      };
    }
    if (table === "chat_conversations") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: data.latestConvo }),
      };
    }
    if (table === "chat_messages") {
      return { insert: insertMock };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: singleMock };
  });

  return { from: fromMock, _insertMock: insertMock };
}

describe("POST /api/plan/regenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 when authorization header is missing", async () => {
    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization header is wrong", async () => {
    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns results array for valid request", async () => {
    const mockClient = makeSupabaseMock();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { weekly_layout: mockWeeklyLayout, reasoning: "Good plan", split_type: "ppl", plan_config: {} },
    });

    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toBeInstanceOf(Array);
    expect(body.week2Monday).toBeDefined();
    expect(body.week2Sunday).toBeDefined();
  });

  it("marks plan as generated when week 2 workouts don't exist", async () => {
    const mockClient = makeSupabaseMock({ existingWorkouts: [] });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { weekly_layout: mockWeeklyLayout, reasoning: "Good plan", split_type: "ppl", plan_config: {} },
    });

    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.results[0].status).toBe("generated");
    expect(body.results[0].userId).toBe("user-1");
  });

  it("skips plan when week 2 workouts already exist", async () => {
    const mockClient = makeSupabaseMock({ existingWorkouts: [{ id: "workout-1" }] });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.results[0].status).toBe("skipped");
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns error result when profile is missing", async () => {
    const mockClient = makeSupabaseMock({ profile: null });
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    expect(body.results[0].status).toBe("error");
    expect(body.results[0].reason).toBe("missing profile or goals");
  });

  it("week2Sunday is 6 days after week2Monday", async () => {
    const mockClient = makeSupabaseMock();
    (createClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: { weekly_layout: mockWeeklyLayout, reasoning: "Plan", split_type: "ppl", plan_config: {} },
    });

    const { POST } = await import("@/app/api/plan/regenerate/route");
    const res = await POST(makeRequest("Bearer test-secret"));
    const body = await res.json();

    const monday = new Date(body.week2Monday);
    const sunday = new Date(body.week2Sunday);
    const diffDays = (sunday.getTime() - monday.getTime()) / 86400000;
    expect(diffDays).toBe(6);
  });
});
