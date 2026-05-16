import { describe, it, expect, vi, beforeEach } from "vitest";

// In-test fluent supabase mock builder.
type Row = Record<string, unknown>;
type Mode = "single" | "maybeSingle" | "select-only" | "noop";

interface BuilderState {
  table: string;
  rows: Row[];
  inserts: Row[];
  updates: Array<{ patch: Row; matchers: Row }>;
  mode: Mode;
  matchers: Row;
}

const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) {
    state.byTable[table] = { table, rows: [], inserts: [], updates: [], mode: "noop", matchers: {} };
  }
  const s = state.byTable[table];

  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.gte = vi.fn(() => chain());
  api.lte = vi.fn(() => chain());
  api.order = vi.fn(() => chain());
  api.limit = vi.fn(() => chain());
  api.maybeSingle = vi.fn(async () => {
    const match = matched(s);
    return { data: match ?? null, error: null };
  });
  api.single = vi.fn(async () => {
    const match = matched(s);
    if (!match) return { data: null, error: { message: "not found" } };
    return { data: match, error: null };
  });
  api.insert = vi.fn((payload: Row | Row[]) => {
    const arr = Array.isArray(payload) ? payload : [payload];
    s.inserts.push(...arr);
    s.rows.push(...arr);
    const selectChain = {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: arr[0], error: null })),
      })),
    };
    return Object.assign(Promise.resolve({ data: null, error: null }), selectChain);
  });
  api.update = vi.fn((patch: Row) => {
    const updateChain = {
      eq: vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return updateChain; }),
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { ...patch }, error: null })),
      })),
    };
    s.updates.push({ patch, matchers: { ...s.matchers } });
    return updateChain;
  });
  api.delete = vi.fn(() => chain());

  return api;
}

function matched(s: BuilderState): Row | undefined {
  for (const r of s.rows) {
    let hit = true;
    for (const [k, v] of Object.entries(s.matchers)) {
      if (r[k] !== v) { hit = false; break; }
    }
    if (hit) return r;
  }
  return undefined;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    from: (table: string) => builderFor(table),
  }),
}));

// Pin today so date guards are deterministic.
vi.mock("@/lib/training/date-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/training/date-guards")>("@/lib/training/date-guards");
  return {
    ...actual,
    todayYmdLocal: () => "2026-05-16",
    assertDateNotPast: (d: string) => actual.assertDateNotPast(d, "2026-05-16"),
  };
});

import { createPlannedWorkoutTool } from "@/lib/chat/tools/create-planned-workout";

interface ToolExecArgs {
  date: string;
  slot?: "am" | "pm" | "full";
  name: string;
  sport: "run" | "bike" | "swim" | "strength";
  contract: {
    version: 1;
    sport: "run" | "bike" | "swim" | "strength";
    name: string;
    slot?: "am" | "pm" | "full" | null;
    source: "onboarding_preview" | "coach" | "heuristic" | "model";
    steps: Array<Record<string, unknown>>;
  };
  ai_notes?: string | null;
  replace_existing?: boolean;
}

type ToolResult = { success: boolean; error?: string; exists?: boolean; created?: boolean; replaced?: boolean; existing?: unknown };

function tool() {
  return createPlannedWorkoutTool("user-123") as unknown as {
    execute: (args: ToolExecArgs) => Promise<ToolResult>;
  };
}

const baseContract = {
  version: 1 as const,
  sport: "run" as const,
  name: "Easy Z2 run",
  slot: "am" as const,
  source: "coach" as const,
  steps: [
    { type: "work", duration_sec: 1800, target_hr_zone: 2 },
  ],
};

describe("createPlannedWorkoutTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = {
      table: "training_plans",
      rows: [{ id: "plan-1", user_id: "user-123", status: "active" }],
      inserts: [],
      updates: [],
      mode: "single",
      matchers: {},
    };
    state.byTable["planned_workouts"] = {
      table: "planned_workouts",
      rows: [],
      inserts: [],
      updates: [],
      mode: "maybeSingle",
      matchers: {},
    };
  });

  it("rejects a past date with a clear error", async () => {
    const r = await tool().execute({
      date: "2026-05-10",
      name: "Easy run",
      sport: "run",
      contract: baseContract,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("past dates are read-only");
  });

  it("rejects malformed date", async () => {
    const r = await tool().execute({
      date: "not-a-date",
      name: "Easy run",
      sport: "run",
      contract: baseContract,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Invalid date");
  });

  it("creates a row when no existing session for that date", async () => {
    const r = await tool().execute({
      date: "2026-05-20",
      name: "Easy Z2 run",
      sport: "run",
      contract: baseContract,
    });
    expect(r.success).toBe(true);
    expect(r.created).toBe(true);
    const inserts = state.byTable["planned_workouts"].inserts;
    expect(inserts).toHaveLength(1);
    expect(inserts[0].session_type).toBe("Easy Z2 run");
    expect(inserts[0].date).toBe("2026-05-20");
    expect((inserts[0].targets as { contract?: { sport?: string } }).contract?.sport).toBe("run");
  });

  it("refuses to overwrite an existing session without replace_existing=true", async () => {
    state.byTable["planned_workouts"].rows.push({
      id: "pw-existing",
      plan_id: "plan-1",
      date: "2026-05-20",
      session_type: "Tempo Run",
      targets: null,
    });
    const r = await tool().execute({
      date: "2026-05-20",
      name: "Easy Z2 run",
      sport: "run",
      contract: baseContract,
    });
    expect(r.success).toBe(false);
    expect(r.exists).toBe(true);
    expect(state.byTable["planned_workouts"].inserts).toHaveLength(0);
  });

  it("replaces an existing session when replace_existing=true", async () => {
    state.byTable["planned_workouts"].rows.push({
      id: "pw-existing",
      plan_id: "plan-1",
      date: "2026-05-20",
      session_type: "Tempo Run",
      targets: null,
    });
    const r = await tool().execute({
      date: "2026-05-20",
      name: "Easy Z2 run",
      sport: "run",
      contract: baseContract,
      replace_existing: true,
    });
    expect(r.success).toBe(true);
    expect(r.replaced).toBe(true);
    expect(state.byTable["planned_workouts"].updates).toHaveLength(1);
  });

  it("accepts today as a valid scheduling date", async () => {
    const r = await tool().execute({
      date: "2026-05-16",
      name: "Push",
      sport: "strength",
      contract: { ...baseContract, sport: "strength", name: "Push" },
    });
    expect(r.success).toBe(true);
  });
});
