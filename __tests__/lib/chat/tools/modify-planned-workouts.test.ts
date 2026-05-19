import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState {
  rows: Row[];
  matchers: Row;
  inIds?: string[];
  updates: Array<{ id: string; patch: Row }>;
}
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], matchers: {}, updates: [] };
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

import { modifyPlannedWorkoutsTool } from "@/lib/chat/tools/modify-planned-workouts";

interface Changes {
  rename_to?: string;
  shift_days?: number;
  set_status?: "scheduled" | "moved" | "skipped";
  set_ai_notes?: string;
}
interface ExecArgs {
  workout_ids: string[];
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
  dropped_past_count?: number;
  missing_ids?: string[];
  updated_count?: number;
  changes_preview?: Array<{ id: string; from: Record<string, unknown>; to: Record<string, unknown>; drop_reason?: string }>;
};

function tool() {
  return modifyPlannedWorkoutsTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const runRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name, ai_notes: null, status: "scheduled",
  targets: { contract: { sport: "run" } },
});

describe("modifyPlannedWorkoutsTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], matchers: {}, updates: [] };
    state.byTable["planned_workouts"] = {
      rows: [
        runRow("pw-1", "2026-05-20", "Easy run"),
        runRow("pw-2", "2026-05-22", "Tempo run"),
        runRow("pw-3", "2026-05-25", "Long run"),
        runRow("pw-past", "2026-05-10", "Past"),
      ],
      matchers: {},
      updates: [],
    };
  });

  it("rejects when no changes provided", async () => {
    const r = await tool().execute({ workout_ids: ["pw-1"], changes: {} });
    expect(r.success).toBe(false);
    expect(r.error).toContain("No changes");
  });

  it("returns a preview-only payload when confirmed is not set", async () => {
    const r = await tool().execute({
      workout_ids: ["pw-1", "pw-2", "pw-3"],
      changes: { rename_to: "Renamed" },
    });
    expect(r.success).toBe(true);
    expect(r.preview).toBe(true);
    expect(r.confirmed).toBe(false);
    expect(r.match_count).toBe(3);
    expect(r.applicable_count).toBe(3);
    expect(state.byTable["planned_workouts"].updates).toHaveLength(0);
  });

  it("applies rename only to the explicitly targeted ids when confirmed", async () => {
    const r = await tool().execute({
      workout_ids: ["pw-1", "pw-3"],
      changes: { rename_to: "Easy" },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.confirmed).toBe(true);
    expect(r.updated_count).toBe(2);
    const rows = state.byTable["planned_workouts"].rows;
    expect(rows.find((x) => x.id === "pw-1")?.session_type).toBe("Easy");
    expect(rows.find((x) => x.id === "pw-2")?.session_type).toBe("Tempo run");
    expect(rows.find((x) => x.id === "pw-3")?.session_type).toBe("Easy");
  });

  it("shifts dates forward by N days when confirmed", async () => {
    const r = await tool().execute({
      workout_ids: ["pw-1", "pw-2", "pw-3"],
      changes: { shift_days: 7 },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.updated_count).toBe(3);
    const dates = state.byTable["planned_workouts"].rows
      .filter((r) => ["pw-1", "pw-2", "pw-3"].includes(r.id as string))
      .map((r) => r.date)
      .sort();
    expect(dates).toEqual(["2026-05-27", "2026-05-29", "2026-06-01"]);
  });

  it("drops past-dated rows from the change set and reports them", async () => {
    const r = await tool().execute({
      workout_ids: ["pw-1", "pw-past"],
      changes: { rename_to: "X" },
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.updated_count).toBe(1);
    expect(r.dropped_past_count).toBe(1);
    const past = state.byTable["planned_workouts"].rows.find((r) => r.id === "pw-past");
    expect(past?.session_type).toBe("Past");
  });

  it("reports missing ids that weren't found", async () => {
    const r = await tool().execute({
      workout_ids: ["pw-1", "does-not-exist"],
      changes: { rename_to: "X" },
    });
    expect(r.success).toBe(true);
    expect(r.match_count).toBe(1);
    expect(r.missing_ids).toContain("does-not-exist");
  });
});
