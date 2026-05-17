import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState { rows: Row[]; matchers: Row; gte?: Record<string, string>; lte?: Record<string, string>; updates: Array<{ id: string; patch: Row }>; }
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], matchers: {}, updates: [] };
  const s = state.byTable[table];
  s.gte = {};
  s.lte = {};
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.gte = vi.fn((col: string, val: string) => { (s.gte ??= {})[col] = val; return chain(); });
  api.lte = vi.fn((col: string, val: string) => { (s.lte ??= {})[col] = val; return chain(); });
  api.single = vi.fn(async () => {
    const m = findAll(s)[0];
    return m ? { data: m, error: null } : { data: null, error: { message: "not found" } };
  });
  api.then = (resolve: (v: unknown) => unknown) => resolve({ data: findAll(s), error: null });
  api.update = vi.fn((patch: Row) => {
    const upd = {
      eq: vi.fn((col: string, val: unknown) => {
        if (col === "id") {
          const target = s.rows.find((r) => r.id === val);
          if (target) {
            Object.assign(target, patch);
            s.updates.push({ id: val as string, patch });
          }
        }
        return upd;
      }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
    };
    return upd;
  });
  return api;
}
function findAll(s: BuilderState): Row[] {
  return s.rows.filter((r) => {
    for (const [k, v] of Object.entries(s.matchers)) if (r[k] !== v) return false;
    for (const [k, v] of Object.entries(s.gte ?? {})) if (typeof r[k] !== "string" || (r[k] as string) < v) return false;
    for (const [k, v] of Object.entries(s.lte ?? {})) if (typeof r[k] !== "string" || (r[k] as string) > v) return false;
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

import { modifyPlannedWorkoutsRangeTool } from "@/lib/chat/tools/modify-planned-workouts-range";

interface Changes {
  rename_to?: string;
  shift_days?: number;
  set_status?: "scheduled" | "moved" | "skipped";
  set_ai_notes?: string;
}
interface ExecArgs {
  start_date: string;
  end_date: string;
  sports?: Array<"run" | "bike" | "swim" | "strength" | "other">;
  session_type_includes?: string;
  changes: Changes;
  confirmed?: boolean;
}
type ExecResult = {
  success: boolean;
  error?: string;
  preview?: boolean;
  confirmed?: boolean;
  match_count?: number;
  applicable_count?: number;
  dropped_count?: number;
  updated_count?: number;
  changes_preview?: Array<{ id: string; from: Record<string, unknown>; to: Record<string, unknown>; drop_reason?: string }>;
};

function tool() {
  return modifyPlannedWorkoutsRangeTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const runRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name, ai_notes: null, status: "scheduled",
  targets: { contract: { sport: "run" } },
});

describe("modifyPlannedWorkoutsRangeTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], matchers: {}, updates: [] };
    state.byTable["planned_workouts"] = {
      rows: [
        runRow("pw-1", "2026-05-20", "Easy run"),
        runRow("pw-2", "2026-05-22", "Tempo run"),
        runRow("pw-3", "2026-05-25", "Long run"),
      ],
      matchers: {},
      updates: [],
    };
  });

  it("rejects when no changes provided", async () => {
    const r = await tool().execute({ start_date: "2026-05-20", end_date: "2026-05-25", changes: {} });
    expect(r.success).toBe(false);
    expect(r.error).toContain("No changes");
  });

  it("returns a preview-only payload when confirmed is not set", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      changes: { rename_to: "Renamed" },
    });
    expect(r.success).toBe(true);
    expect(r.preview).toBe(true);
    expect(r.confirmed).toBe(false);
    expect(r.match_count).toBe(3);
    expect(r.applicable_count).toBe(3);
    // No DB writes on preview.
    expect(state.byTable["planned_workouts"].updates).toHaveLength(0);
  });

  it("applies rename across the matched range when confirmed", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      changes: { rename_to: "Easy" },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.confirmed).toBe(true);
    expect(r.updated_count).toBe(3);
    for (const row of state.byTable["planned_workouts"].rows) {
      expect(row.session_type).toBe("Easy");
    }
  });

  it("shifts dates forward by N days when confirmed", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      changes: { shift_days: 7 },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.updated_count).toBe(3);
    const dates = state.byTable["planned_workouts"].rows.map((r) => r.date).sort();
    expect(dates).toEqual(["2026-05-27", "2026-05-29", "2026-06-01"]);
  });

  it("drops rows that would land in the past after a backward shift", async () => {
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      changes: { shift_days: -10 },
      confirmed: true,
    });
    // pw-1 (May 20) - 10 = May 10 (past, dropped). pw-2/pw-3 land May 12/15 — also past, dropped.
    expect(r.success).toBe(true);
    expect(r.updated_count).toBe(0);
    expect(r.dropped_count).toBe(3);
  });

  it("filters by sport before applying changes", async () => {
    state.byTable["planned_workouts"].rows.push({
      id: "pw-lift", plan_id: "plan-1", date: "2026-05-23", session_type: "Lift",
      ai_notes: null, status: "scheduled",
      targets: { contract: { sport: "strength" } },
    });
    const r = await tool().execute({
      start_date: "2026-05-20",
      end_date: "2026-05-25",
      sports: ["strength"],
      changes: { rename_to: "Heavy day" },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.updated_count).toBe(1);
    const lift = state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-lift");
    expect(lift?.session_type).toBe("Heavy day");
    // Run rows untouched.
    const run = state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-1");
    expect(run?.session_type).toBe("Easy run");
  });
});
