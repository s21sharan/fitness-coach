import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState {
  rows: Row[];
  matchers: Row;
  inIds?: string[];
  inserted: Row[];
}
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], matchers: {}, inserted: [] };
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
  api.insert = vi.fn((rows: Row[]) => {
    const enriched = rows.map((r, i) => ({ id: `inserted-${s.inserted.length + i + 1}`, ...r }));
    s.inserted.push(...enriched);
    s.rows.push(...enriched);
    return {
      select: vi.fn(() => ({
        then: (resolve: (v: unknown) => unknown) => resolve({ data: enriched, error: null }),
      })),
    };
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

import { swapPlannedWorkoutsTool } from "@/lib/chat/tools/swap-planned-workouts";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";

interface NewSession {
  date: string;
  slot?: "am" | "pm" | "full";
  sport: "run" | "bike" | "swim" | "strength" | "other";
  name: string;
  contract: WorkoutContractV1;
  ai_notes?: string | null;
}
interface ExecArgs {
  workout_ids_to_replace: string[];
  new_sessions: NewSession[];
  confirmed?: boolean;
}
type ExecResult = {
  success: boolean;
  error?: string;
  preview?: boolean;
  confirmed?: boolean;
  removing_count?: number;
  adding_count?: number;
  deleted_count?: number;
  inserted_count?: number;
  dropped_past_count?: number;
  missing_ids?: string[];
};

function tool() {
  return swapPlannedWorkoutsTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

const liftRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name,
  targets: { contract: { sport: "strength", name } },
});
const runRow = (id: string, date: string, name: string) => ({
  id, plan_id: "plan-1", date, session_type: name,
  targets: { contract: { sport: "run", name } },
});

const liftContract = (name: string): WorkoutContractV1 => ({
  version: 1,
  sport: "strength",
  name,
  source: "coach",
  steps: [{ type: "work", label: name, duration_sec: 3600, sets: 4, reps: 8 }],
});

describe("swapPlannedWorkoutsTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], matchers: {}, inserted: [] };
    state.byTable["planned_workouts"] = {
      rows: [
        liftRow("pw-lift-1", "2026-05-19", "Push"),
        runRow("pw-run-1", "2026-05-20", "Easy run"),
        liftRow("pw-lift-2", "2026-05-21", "Pull"),
        runRow("pw-run-2", "2026-05-22", "Tempo run"),
        liftRow("pw-lift-3", "2026-05-23", "Legs"),
      ],
      matchers: {},
      inserted: [],
    };
  });

  it("returns a preview without touching the DB when confirmed is omitted", async () => {
    const r = await tool().execute({
      workout_ids_to_replace: ["pw-lift-1", "pw-lift-2", "pw-lift-3"],
      new_sessions: [
        { date: "2026-05-19", sport: "strength", name: "Upper", contract: liftContract("Upper") },
        { date: "2026-05-21", sport: "strength", name: "Lower", contract: liftContract("Lower") },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.preview).toBe(true);
    expect(r.removing_count).toBe(3);
    expect(r.adding_count).toBe(2);
    // No mutations.
    expect(state.byTable["planned_workouts"].rows).toHaveLength(5);
  });

  it("on confirm, replaces only the targeted ids and leaves the others alone", async () => {
    const r = await tool().execute({
      workout_ids_to_replace: ["pw-lift-1", "pw-lift-2", "pw-lift-3"],
      new_sessions: [
        { date: "2026-05-19", sport: "strength", name: "Upper", contract: liftContract("Upper") },
        { date: "2026-05-21", sport: "strength", name: "Lower", contract: liftContract("Lower") },
      ],
      confirmed: true,
    });
    expect(r.success).toBe(true);
    expect(r.deleted_count).toBe(3);
    expect(r.inserted_count).toBe(2);
    // Runs untouched.
    const remainingIds = state.byTable["planned_workouts"].rows.map((r) => r.id);
    expect(remainingIds).toContain("pw-run-1");
    expect(remainingIds).toContain("pw-run-2");
    // Lift rows gone.
    expect(remainingIds).not.toContain("pw-lift-1");
    expect(remainingIds).not.toContain("pw-lift-2");
    expect(remainingIds).not.toContain("pw-lift-3");
    // New ones inserted.
    const inserted = state.byTable["planned_workouts"].inserted;
    expect(inserted.map((r) => r.session_type).sort()).toEqual(["Lower", "Upper"]);
  });

  it("rejects when any new session is dated in the past", async () => {
    const r = await tool().execute({
      workout_ids_to_replace: ["pw-lift-1"],
      new_sessions: [{ date: "2026-05-10", sport: "strength", name: "Old", contract: liftContract("Old") }],
      confirmed: true,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("past");
  });
});
