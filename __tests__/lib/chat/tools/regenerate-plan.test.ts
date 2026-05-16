import { describe, it, expect, vi, beforeEach } from "vitest";

// ── blocks mock ───────────────────────────────────────────────────────────────

const mockGetActiveBlock = vi.fn();

vi.mock("@/lib/training/blocks", () => ({
  getActiveBlock: (...args: unknown[]) => mockGetActiveBlock(...args),
}));

// ── generateMultiWeekPlan mock ────────────────────────────────────────────────

const mockGenerateMultiWeekPlan = vi.fn();

vi.mock("@/lib/training/generate-plan", () => ({
  generateMultiWeekPlan: (...args: unknown[]) => mockGenerateMultiWeekPlan(...args),
}));

// ── compliance mocks ─────────────────────────────────────────────────────────

vi.mock("@/lib/training/compliance", () => ({
  computeComplianceStats: vi.fn(() => ({ totalPlanned: 0 })),
  formatComplianceForPrompt: vi.fn(() => "compliance text"),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Needs to handle deeply chained calls:
//   .from(table).select(...).eq(...).eq(...).single()          — user_profiles, user_goals, training_plans
//   .from(table).select(...).eq(...).gte(...).lte(...)         — planned_workouts (when active block)
//   .from(table).select(...).eq(...).eq(...).gte(...).order()  — workout_logs, cardio_logs

function makeChain(terminalData: unknown = null) {
  const chain: Record<string, unknown> = {};
  const terminal = Promise.resolve({ data: terminalData, error: null });
  // Each method returns itself so any chain depth resolves to terminal
  const proxy: unknown = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "then") return (terminal as Promise<unknown>).then.bind(terminal);
      if (prop === "catch") return (terminal as Promise<unknown>).catch.bind(terminal);
      return () => proxy;
    },
  });
  return proxy;
}

// Track which single() mock to return per call index
let singleCallIndex = 0;
const singleResponses: Array<{ data: unknown }> = [];

const mockFrom = vi.fn((_table: string) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => {
          const resp = singleResponses[singleCallIndex] ?? { data: null };
          singleCallIndex++;
          return Promise.resolve(resp);
        }),
        gte: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      single: vi.fn(() => {
        const resp = singleResponses[singleCallIndex] ?? { data: null };
        singleCallIndex++;
        return Promise.resolve(resp);
      }),
      gte: vi.fn(() => ({
        lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makePlanResult() {
  return {
    split_type: "ppl",
    narrative: "Great plan",
    risks: [],
    plan_config: {},
    weeks: [
      {
        week_number: 1,
        week_focus: "Accumulation",
        days: [
          {
            day_label: "Monday",
            am_session: {
              sport: "strength" as const,
              name: "Push",
              rationale: "Heavy chest",
              contract: {
                version: 1 as const,
                sport: "strength" as const,
                name: "Push",
                slot: "am" as const,
                source: "coach" as const,
                steps: [{ type: "work" as const, label: "Bench" }],
              },
            },
            pm_session: null,
            is_rest: false,
          },
          {
            day_label: "Sunday",
            am_session: null,
            pm_session: null,
            is_rest: true,
          },
        ],
      },
    ],
  };
}

const DEFAULT_INPUT = {
  user_request: "I want a PPL split",
  split_type: "ppl" as const,
  days_per_week: 5,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("regeneratePlanTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleCallIndex = 0;
    singleResponses.length = 0;
    mockGetActiveBlock.mockResolvedValue(null);
    mockGenerateMultiWeekPlan.mockResolvedValue(makePlanResult());
  });

  // Helper: setup single() calls in order: [profile, goals, activePlan]
  function setupSingles(profile: unknown, goals: unknown, activePlan: unknown) {
    singleResponses.push({ data: profile }, { data: goals }, { data: activePlan });
  }

  it("exports a tool with expected description", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    expect(t).toBeDefined();
    expect(t.description).toContain("proposed");
  });

  it("returns block_id: null when no active block exists", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    const result = await t.execute(DEFAULT_INPUT, {} as never);
    expect(result.block_id).toBeNull();
  });

  it("returns block_id from active block when one exists", async () => {
    setupSingles(null, null, { id: "plan-abc" });
    mockGetActiveBlock.mockResolvedValue({
      id: "block-xyz",
      plan_id: "plan-abc",
      week_count: 4,
      start_date: "2026-05-01",
      end_date: "2026-05-28",
      status: "active",
    });

    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    const result = await t.execute(DEFAULT_INPUT, {} as never);
    expect(result.block_id).toBe("block-xyz");
  });

  it("uses activeBlock.week_count as weeks param when block exists", async () => {
    setupSingles(null, null, { id: "plan-abc" });
    mockGetActiveBlock.mockResolvedValue({
      id: "block-xyz",
      plan_id: "plan-abc",
      week_count: 4,
      start_date: "2026-05-01",
      end_date: "2026-05-28",
      status: "active",
    });

    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    await t.execute(DEFAULT_INPUT, {} as never);

    const callArgs = mockGenerateMultiWeekPlan.mock.calls[0][0];
    expect(callArgs.weeks).toBe(4);
  });

  it("falls back to 2 weeks when no active block exists", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    await t.execute(DEFAULT_INPUT, {} as never);

    const callArgs = mockGenerateMultiWeekPlan.mock.calls[0][0];
    expect(callArgs.weeks).toBe(2);
  });

  it("returns proposed: true and success: true", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    const result = await t.execute(DEFAULT_INPUT, {} as never);
    expect(result.success).toBe(true);
    expect(result.proposed).toBe(true);
  });

  it("shapes week_layouts from plan.weeks", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    const result = await t.execute(DEFAULT_INPUT, {} as never);
    expect(result.week_layouts).toHaveLength(1);
    expect(result.week_layouts[0].week_number).toBe(1);
    expect(result.week_layouts[0].days[0].session).toBe("Push");
    expect(result.week_layouts[0].days[1].session).toBe("Rest");
  });

  it("does not call getActiveBlock when no active plan", async () => {
    setupSingles(null, null, null);
    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    await t.execute(DEFAULT_INPUT, {} as never);

    expect(mockGetActiveBlock).not.toHaveBeenCalled();
  });

  it("calls getActiveBlock with the plan id when active plan exists", async () => {
    setupSingles(null, null, { id: "plan-abc" });
    mockGetActiveBlock.mockResolvedValue(null);

    const { regeneratePlanTool } = await import("@/lib/chat/tools/regenerate-plan");
    const t = regeneratePlanTool("user-123");
    await t.execute(DEFAULT_INPUT, {} as never);

    expect(mockGetActiveBlock).toHaveBeenCalledWith("plan-abc");
  });
});
