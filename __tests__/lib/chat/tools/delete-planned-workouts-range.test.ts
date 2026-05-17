import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState { rows: Row[]; matchers: Row; gte?: Record<string, string>; lte?: Record<string, string>; inIds?: string[]; }
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], matchers: {} };
  const s = state.byTable[table];
  s.gte = {};
  s.lte = {};
  s.inIds = undefined;
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.gte = vi.fn((col: string, val: string) => { (s.gte ??= {})[col] = val; return chain(); });
  api.lte = vi.fn((col: string, val: string) => { (s.lte ??= {})[col] = val; return chain(); });
  api.in = vi.fn((col: string, vals: string[]) => { if (col === "id") s.inIds = vals; return chain(); });
  api.single = vi.fn(async () => {
    const m = findAll(s)[0];
    return m ? { data: m, error: null } : { data: null, error: { message: "not found" } };
  });
  api.then = (resolve: (v: unknown) => unknown) => resolve({ data: findAll(s), error: null });
  api.delete = vi.fn(() => {
    const del = {
      eq: vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return del; }),
      in: vi.fn((col: string, vals: string[]) => { if (col === "id") s.inIds = vals; return del; }),
      then: (resolve: (v: unknown) => unknown) => {
        const removed = findAll(s);
        s.rows = s.rows.filter((r) => !removed.includes(r));
        return resolve({ data: null, error: null });
      },
    };
    return del;
  });
  return api;
}
function findAll(s: BuilderState): Row[] {
  return s.rows.filter((r) => {
    for (const [k, v] of Object.entries(s.matchers)) if (r[k] !== v) return false;
    for (const [k, v] of Object.entries(s.gte ?? {})) if (typeof r[k] !== "string" || (r[k] as string) < v) return false;
    for (const [k, v] of Object.entries(s.lte ?? {})) if (typeof r[k] !== "string" || (r[k] as string) > v) return false;
    if (s.inIds && !s.inIds.includes(r.id as string)) return false;
    return true;
  });
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

import { deletePlannedWorkoutsRangeTool } from "@/lib/chat/tools/delete-planned-workouts-range";

interface ExecArgs {
  start_date: string;
  end_date: string;
  sports?: Array<"run" | "bike" | "swim" | "strength" | "other">;
  session_type_includes?: string;
}
type ExecResult = { success: boolean; error?: string; deleted_count?: number; deleted?: Array<{ id: string; date: string }> };

function tool() {
  return deletePlannedWorkoutsRangeTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const runRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name,
  targets: { contract: { sport: "run" } },
});
const liftRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name,
  targets: { contract: { sport: "strength" } },
});

describe("deletePlannedWorkoutsRangeTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], matchers: {} };
    state.byTable["planned_workouts"] = {
      rows: [
        runRow("pw-1", "2026-05-20", "Easy run"),
        liftRow("pw-2", "2026-05-21", "Upper lift"),
        runRow("pw-3", "2026-05-22", "Tempo run"),
        runRow("pw-4", "2026-05-25", "Long run"),
        runRow("pw-5", "2026-06-01", "Out of range"),
        runRow("pw-past", "2026-05-10", "Past, should be untouched"),
      ],
      matchers: {},
    };
  });

  it("rejects end < start", async () => {
    const r = await tool().execute({ start_date: "2026-05-25", end_date: "2026-05-20" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("end_date");
  });

  it("deletes everything in the range when no filters are given", async () => {
    const r = await tool().execute({ start_date: "2026-05-20", end_date: "2026-05-25" });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(4);
    // out-of-range and past rows survive
    const remaining = state.byTable["planned_workouts"].rows.map((r) => r.id);
    expect(remaining).toContain("pw-5");
    expect(remaining).toContain("pw-past");
  });

  it("clamps past start_dates up to today and never touches past sessions", async () => {
    const r = await tool().execute({ start_date: "2026-05-01", end_date: "2026-05-25" });
    expect(r.success).toBe(true);
    // pw-past (2026-05-10) is before clamped start (2026-05-16) — must survive.
    expect(state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-past")).toBeDefined();
  });

  it("applies the sport filter", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      sports: ["run"],
    });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(3);
    // lift row survives
    expect(state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-2")).toBeDefined();
  });

  it("applies the session_type_includes filter case-insensitively", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      session_type_includes: "TEMPO",
    });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(1);
    expect(r.deleted?.[0].id).toBe("pw-3");
  });

  it("returns deleted_count=0 when nothing matches", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      session_type_includes: "yoga",
    });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(0);
  });
});
