import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState {
  rows: Row[];
  matchers: Row;
  inIds?: string[];
}
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], matchers: {} };
  const s = state.byTable[table];
  s.inIds = undefined;
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.in = vi.fn((col: string, vals: string[]) => { if (col === "id") s.inIds = vals; return chain(); });
  api.single = vi.fn(async () => {
    const m = findAll(s)[0];
    return m ? { data: m, error: null } : { data: null, error: { message: "not found" } };
  });
  api.then = (resolve: (v: unknown) => unknown) => resolve({ data: findAll(s), error: null });
  api.delete = vi.fn(() => {
    const del = {
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

import { deletePlannedWorkoutsTool } from "@/lib/chat/tools/delete-planned-workouts";

interface ExecArgs {
  workout_ids: string[];
  confirmed?: boolean;
}
type ExecResult = {
  success: boolean;
  error?: string;
  preview?: boolean;
  confirmed?: boolean;
  match_count?: number;
  dropped_past_count?: number;
  missing_ids?: string[];
  deleted_count?: number;
  to_delete?: Array<{ id: string; date: string; session_type: string }>;
  deleted?: Array<{ id: string; date: string; session_type: string }>;
};

function tool() {
  return deletePlannedWorkoutsTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const row = (id: string, date: string, name: string, sport = "run") => ({
  id, plan_id: "plan-1", date, session_type: name,
  targets: { contract: { sport } },
});

describe("deletePlannedWorkoutsTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], matchers: {} };
    state.byTable["planned_workouts"] = {
      rows: [
        row("pw-1", "2026-05-20", "Easy run"),
        row("pw-2", "2026-05-21", "Upper lift", "strength"),
        row("pw-3", "2026-05-22", "Tempo run"),
        row("pw-past", "2026-05-10", "Past, untouchable"),
      ],
      matchers: {},
    };
  });

  it("returns a preview-only payload by default (no writes)", async () => {
    const r = await tool().execute({ workout_ids: ["pw-1", "pw-2"] });
    expect(r.success).toBe(true);
    expect(r.preview).toBe(true);
    expect(r.confirmed).toBe(false);
    expect(r.match_count).toBe(2);
    expect(state.byTable["planned_workouts"].rows).toHaveLength(4);
  });

  it("deletes only the explicit ids when confirmed", async () => {
    const r = await tool().execute({ workout_ids: ["pw-1", "pw-3"], confirmed: true });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(2);
    const remaining = state.byTable["planned_workouts"].rows.map((r) => r.id).sort();
    expect(remaining).toEqual(["pw-2", "pw-past"]);
  });

  it("filters out past-dated rows even when explicitly requested", async () => {
    const r = await tool().execute({ workout_ids: ["pw-1", "pw-past"], confirmed: true });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(1);
    expect(r.dropped_past_count).toBe(1);
    // pw-past survives
    expect(state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-past")).toBeDefined();
  });

  it("reports missing ids", async () => {
    const r = await tool().execute({ workout_ids: ["pw-1", "does-not-exist"] });
    expect(r.success).toBe(true);
    expect(r.missing_ids).toContain("does-not-exist");
  });
});
