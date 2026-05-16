import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState { rows: Row[]; updates: Array<{ patch: Row; matchers: Row }>; matchers: Row; }
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], updates: [], matchers: {} };
  const s = state.byTable[table];
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.maybeSingle = vi.fn(async () => ({ data: find(s) ?? null, error: null }));
  api.single = vi.fn(async () => {
    const m = find(s);
    if (!m) return { data: null, error: { message: "not found" } };
    return { data: m, error: null };
  });
  api.update = vi.fn((patch: Row) => {
    const upd = {
      eq: vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return upd; }),
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { ...patch }, error: null })),
      })),
    };
    s.updates.push({ patch, matchers: { ...s.matchers } });
    return upd;
  });
  return api;
}
function find(s: BuilderState): Row | undefined {
  return s.rows.find((r) => Object.entries(s.matchers).every(([k, v]) => r[k] === v));
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: (t: string) => builderFor(t) }),
}));

vi.mock("@/lib/training/date-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/training/date-guards")>("@/lib/training/date-guards");
  return {
    ...actual,
    todayYmdLocal: () => "2026-05-16",
    assertDateNotPast: (d: string) => actual.assertDateNotPast(d, "2026-05-16"),
  };
});

import { updatePlannedWorkoutTool } from "@/lib/chat/tools/update-planned-workout";

interface ExecArgs {
  date: string;
  name?: string;
  session_type?: string;
  contract?: {
    version: 1;
    sport: "run" | "bike" | "swim" | "strength";
    name: string;
    slot?: "am" | "pm" | "full" | null;
    source: "coach" | "onboarding_preview" | "heuristic" | "model";
    steps: Array<Record<string, unknown>>;
  };
  ai_notes?: string;
  status?: "scheduled" | "moved";
}
type ExecResult = { success: boolean; error?: string; updated?: Row };

function tool() {
  return updatePlannedWorkoutTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const baseContract = {
  version: 1 as const,
  sport: "run" as const,
  name: "Easy run",
  slot: "am" as const,
  source: "coach" as const,
  steps: [{ type: "work", duration_sec: 1800, target_hr_zone: 2 }],
};

describe("updatePlannedWorkoutTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], updates: [], matchers: {} };
    state.byTable["planned_workouts"] = {
      rows: [{ id: "pw-1", plan_id: "plan-1", date: "2026-05-20", session_type: "Tempo Run", targets: { target_distance_km: 5 } }],
      updates: [],
      matchers: {},
    };
  });

  it("rejects a past date", async () => {
    const r = await tool().execute({ date: "2026-05-10", name: "Rest" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("past dates are read-only");
  });

  it("updates session_type via legacy field", async () => {
    const r = await tool().execute({ date: "2026-05-20", session_type: "Rest" });
    expect(r.success).toBe(true);
    expect(state.byTable["planned_workouts"].updates[0].patch.session_type).toBe("Rest");
  });

  it("updates session_type via new `name` input", async () => {
    const r = await tool().execute({ date: "2026-05-20", name: "Easy Z2 run" });
    expect(r.success).toBe(true);
    expect(state.byTable["planned_workouts"].updates[0].patch.session_type).toBe("Easy Z2 run");
  });

  it("replaces the contract and merges into existing targets", async () => {
    const r = await tool().execute({
      date: "2026-05-20",
      name: "Easy Z2 run",
      contract: baseContract,
    });
    expect(r.success).toBe(true);
    const patch = state.byTable["planned_workouts"].updates[0].patch as {
      targets: { contract: { sport: string }; target_distance_km?: number; target_duration_min?: number };
    };
    expect(patch.targets.contract.sport).toBe("run");
    expect(patch.targets.target_distance_km).toBe(5); // preserved from existing
    expect(typeof patch.targets.target_duration_min).toBe("number");
  });

  it("returns error when no fields provided", async () => {
    const r = await tool().execute({ date: "2026-05-20" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("No changes");
  });
});
