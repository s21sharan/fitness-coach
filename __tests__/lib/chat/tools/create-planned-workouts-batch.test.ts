import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
interface BuilderState { rows: Row[]; inserts: Row[]; matchers: Row; }
const state: { byTable: Record<string, BuilderState> } = { byTable: {} };

function builderFor(table: string) {
  if (!state.byTable[table]) state.byTable[table] = { rows: [], inserts: [], matchers: {} };
  const s = state.byTable[table];
  const api: Record<string, unknown> = {};
  const chain = () => api;
  api.select = vi.fn(() => chain());
  api.eq = vi.fn((col: string, val: unknown) => { s.matchers[col] = val; return chain(); });
  api.order = vi.fn(() => chain());
  api.limit = vi.fn(() => chain());
  api.single = vi.fn(async () => {
    const m = find(s);
    return m ? { data: m, error: null } : { data: null, error: { message: "not found" } };
  });
  api.insert = vi.fn((patch: Row) => {
    s.inserts.push(patch);
    const inserted = { id: `${table}-${s.inserts.length}`, ...patch };
    s.rows.push(inserted);
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: inserted, error: null })),
      })),
    };
  });
  return api;
}
function find(s: BuilderState): Row | undefined {
  if (Object.keys(s.matchers).length === 0) return s.rows[0];
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

import { createPlannedWorkoutsBatchTool } from "@/lib/chat/tools/create-planned-workouts-batch";

const baseContract = {
  version: 1 as const,
  sport: "run" as const,
  name: "Easy Z2 run",
  slot: "am" as const,
  source: "coach" as const,
  steps: [{ type: "work" as const, duration_sec: 1800, target_hr_zone: 2 }],
};

interface SessionIn {
  date: string;
  slot: "am" | "pm" | "full";
  sport: "run" | "bike" | "swim" | "strength" | "other";
  name: string;
  contract: typeof baseContract;
  rationale?: string;
}
interface ExecArgs {
  label: string;
  phase: "base" | "build" | "peak" | "taper" | "accumulation" | "intensification" | "deload";
  start_date: string;
  end_date: string;
  sessions: SessionIn[];
  narrative?: string;
  risks?: string[];
  user_override_schedule?: boolean;
}
type ExecResult = {
  success: boolean;
  error?: string;
  proposed?: boolean;
  block_id?: string;
  week_count?: number;
  week_layouts?: Array<{ week_number: number; days: Array<{ day_label: string; am_session: string | null; pm_session: string | null; is_rest: boolean }> }>;
  risks?: string[];
};

function tool() {
  return createPlannedWorkoutsBatchTool("user-123") as unknown as { execute: (a: ExecArgs) => Promise<ExecResult> };
}

describe("createPlannedWorkoutsBatchTool", () => {
  beforeEach(() => {
    state.byTable = {};
    state.byTable["training_plans"] = { rows: [{ id: "plan-1", user_id: "user-123", status: "active" }], inserts: [], matchers: {} };
    state.byTable["training_blocks"] = { rows: [], inserts: [], matchers: {} };
  });

  it("rejects past start_date", async () => {
    const r = await tool().execute({
      label: "Bad", phase: "base",
      start_date: "2026-05-10", end_date: "2026-05-20",
      sessions: [{ date: "2026-05-12", slot: "am", sport: "run", name: "Run", contract: baseContract }],
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("past dates");
  });

  it("rejects session falling outside the batch window", async () => {
    const r = await tool().execute({
      label: "Bad", phase: "base",
      start_date: "2026-05-18", end_date: "2026-05-24",
      sessions: [{ date: "2026-05-30", slot: "am", sport: "run", name: "Run", contract: baseContract }],
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("outside the batch window");
  });

  it("creates a proposed-status training_blocks row as loose metadata", async () => {
    const r = await tool().execute({
      label: "Base running",
      phase: "base",
      start_date: "2026-05-18",
      end_date: "2026-06-14",
      sessions: [
        { date: "2026-05-19", slot: "am", sport: "run", name: "Tue run", contract: baseContract },
        { date: "2026-05-23", slot: "am", sport: "run", name: "Long run", contract: baseContract },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.proposed).toBe(true);
    expect(r.block_id).toBeDefined();
    expect(r.week_layouts).toBeDefined();

    const blockInsert = state.byTable["training_blocks"].inserts[0];
    expect(blockInsert.status).toBe("proposed");
    expect(blockInsert.block_type).toBe("base");
    expect(blockInsert.block_label).toBe("Base running");
  });

  it("supports sport=other (e.g. mobility)", async () => {
    const r = await tool().execute({
      label: "Mobility week",
      phase: "deload",
      start_date: "2026-05-18",
      end_date: "2026-05-24",
      sessions: [{
        date: "2026-05-19", slot: "am", sport: "other", name: "Hip mobility",
        contract: { ...baseContract, sport: "other", name: "Hip mobility" } as unknown as typeof baseContract,
      }],
    });
    expect(r.success).toBe(true);
  });

  it("surfaces an override risk note when user_override_schedule is true", async () => {
    const r = await tool().execute({
      label: "Override",
      phase: "build",
      start_date: "2026-05-18",
      end_date: "2026-05-24",
      sessions: [{ date: "2026-05-19", slot: "pm", sport: "run", name: "PM run", contract: baseContract }],
      user_override_schedule: true,
    });
    expect(r.success).toBe(true);
    expect(r.risks?.[0]).toContain("outside your normal availability");
  });
});
