import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState { rows: Row[]; deleted: Row[][]; matchers: Row; }
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], deleted: [], matchers: {} };
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
  // Treat the chain itself as the awaitable for non-single selects (return all matching rows).
  api.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: findAll(s), error: null });
  api.delete = vi.fn(() => {
    const del = {
      eq: vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return del; }),
      then: (resolve: (v: unknown) => unknown) => {
        const removed = findAll(s);
        s.deleted.push(removed);
        s.rows = s.rows.filter((r) => !removed.includes(r));
        return resolve({ data: null, error: null });
      },
    };
    return del;
  });
  return api;
}
function find(s: BuilderState): Row | undefined {
  return s.rows.find((r) => Object.entries(s.matchers).every(([k, v]) => r[k] === v));
}
function findAll(s: BuilderState): Row[] {
  return s.rows.filter((r) => Object.entries(s.matchers).every(([k, v]) => r[k] === v));
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

import { deletePlannedWorkoutTool } from "@/lib/chat/tools/delete-planned-workout";

type ExecResult = {
  success: boolean;
  error?: string;
  deleted?: { date: string; session_type: string; id: string };
  candidates?: Array<{ id: string; session_type: string }>;
};

function tool() {
  return deletePlannedWorkoutTool("user-123") as unknown as {
    execute: (a: { date: string; name?: string }) => Promise<ExecResult>;
  };
}

describe("deletePlannedWorkoutTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], deleted: [], matchers: {} };
    state.byTable["planned_workouts"] = {
      rows: [
        { id: "pw-1", plan_id: "plan-1", date: "2026-05-20", session_type: "Tempo Run" },
        { id: "pw-2", plan_id: "plan-1", date: "2026-05-21", session_type: "AM: Easy run" },
        { id: "pw-3", plan_id: "plan-1", date: "2026-05-21", session_type: "PM: Lift" },
      ],
      deleted: [],
      matchers: {},
    };
  });

  it("rejects a past date", async () => {
    const r = await tool().execute({ date: "2026-05-10" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("past dates are read-only");
  });

  it("deletes a single matching planned workout", async () => {
    const r = await tool().execute({ date: "2026-05-20" });
    expect(r.success).toBe(true);
    expect(r.deleted?.id).toBe("pw-1");
    expect(state.byTable["planned_workouts"].rows.find((row) => row.id === "pw-1")).toBeUndefined();
  });

  it("errors when no workout matches the date", async () => {
    const r = await tool().execute({ date: "2026-06-01" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("No planned workout found");
  });

  it("refuses ambiguous deletes when multiple rows share a date", async () => {
    const r = await tool().execute({ date: "2026-05-21" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Multiple planned workouts");
    expect(r.candidates).toHaveLength(2);
  });

  it("disambiguates via the `name` argument", async () => {
    const r = await tool().execute({ date: "2026-05-21", name: "PM: Lift" });
    expect(r.success).toBe(true);
    expect(r.deleted?.session_type).toBe("PM: Lift");
    expect(state.byTable["planned_workouts"].rows.find((row) => row.id === "pw-3")).toBeUndefined();
    expect(state.byTable["planned_workouts"].rows.find((row) => row.id === "pw-2")).toBeDefined();
  });
});
