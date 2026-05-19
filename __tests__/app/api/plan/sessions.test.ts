import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "user-abc" })),
}));

// Pin "today" so future-date validation is deterministic. We pick a date
// before the test dates used below so the guard always passes.
vi.mock("@/lib/training/date-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/training/date-guards")>(
    "@/lib/training/date-guards",
  );
  return {
    ...actual,
    todayYmdLocal: () => "2026-05-17",
    assertDateNotPast: (d: string) => actual.assertDateNotPast(d, "2026-05-17"),
  };
});

type Row = Record<string, unknown>;
interface TableState {
  rows: Row[];
  inserted: Row[];
}
const state: { byTable: Record<string, TableState>; nextId: number } = {
  byTable: {},
  nextId: 0,
};

function tableState(name: string): TableState {
  if (!state.byTable[name]) state.byTable[name] = { rows: [], inserted: [] };
  return state.byTable[name];
}

function builderFor(name: string) {
  const st = tableState(name);
  const preds: Array<(r: Row) => boolean> = [];
  const evalRows = () => st.rows.filter((r) => preds.every((p) => p(r)));

  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    preds.push((r) => r[col] === val);
    return chain;
  });
  chain.maybeSingle = vi.fn(async () => ({ data: evalRows()[0] ?? null, error: null }));
  chain.single = vi.fn(async () => {
    const ins = st.inserted.shift();
    return { data: ins ?? evalRows()[0] ?? null, error: ins ? null : (evalRows()[0] ? null : { message: "not found" }) };
  });
  chain.insert = vi.fn((row: Row) => {
    const rec = { id: `id-${++state.nextId}`, ...row };
    st.rows.push(rec);
    st.inserted.push(rec);
    return chain;
  });
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: (n: string) => builderFor(n) })),
}));

beforeEach(() => {
  state.byTable = {};
  state.nextId = 0;
  // Default: seed an active plan for the test user.
  tableState("training_plans").rows.push({
    id: "plan-1",
    user_id: "user-abc",
    status: "active",
  });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/plan/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/plan/sessions — auth & validation", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Easy",
    }));
    expect(res.status).toBe(401);
  });

  it("rejects bad date format", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({ date: "May 20", sport: "run", session_type: "Easy" }));
    expect(res.status).toBe(400);
  });

  it("rejects past dates", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-10", sport: "run", session_type: "Easy",
    }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown sport", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "yoga", session_type: "Flow",
    }));
    expect(res.status).toBe(400);
  });

  it("rejects empty session_type", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "   ",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user has no active plan", async () => {
    // Wipe the seeded plan.
    state.byTable["training_plans"].rows = [];
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Easy",
    }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/plan/sessions — insert shape", () => {
  it("inserts a scheduled, approved planned_workout into the active plan", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20",
      sport: "run",
      session_type: "Easy Z2 run",
      slot: "am",
      ai_notes: "Aerobic base — keep it conversational.",
      target_duration_min: 45,
      target_distance_km: 8,
      target_pace_min_km: 6.0,
      target_hr_zone: 2,
    }));
    expect(res.status).toBe(200);

    const inserted = state.byTable["planned_workouts"].rows[0];
    expect(inserted.plan_id).toBe("plan-1");
    expect(inserted.date).toBe("2026-05-20");
    // 2026-05-20 is a Wednesday → day_of_week (Mon=0) = 2.
    expect(inserted.day_of_week).toBe(2);
    expect(inserted.session_type).toBe("Easy Z2 run");
    expect(inserted.ai_notes).toBe("Aerobic base — keep it conversational.");
    expect(inserted.approved).toBe(true);
    expect(inserted.status).toBe("scheduled");

    const targets = inserted.targets as Record<string, unknown>;
    expect(targets.target_distance_km).toBe(8);
    expect(targets.target_duration_min).toBe(45);
    expect(targets.target_pace_min_km).toBe(6.0);
    expect(targets.target_hr_zone).toBe(2);

    const contract = targets.contract as Record<string, unknown>;
    expect(contract.version).toBe(1);
    expect(contract.sport).toBe("run");
    expect(contract.name).toBe("Easy Z2 run");
    expect(contract.slot).toBe("am");
  });

  it("defaults slot to 'full' when omitted", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    await POST(jsonReq({
      date: "2026-05-20", sport: "strength", session_type: "Push day",
      target_duration_min: 60,
    }));
    const inserted = state.byTable["planned_workouts"].rows[0];
    const contract = (inserted.targets as Record<string, unknown>).contract as Record<string, unknown>;
    expect(contract.slot).toBe("full");
  });

  it("stores muscle_focus for strength sessions", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    await POST(jsonReq({
      date: "2026-05-20", sport: "strength", session_type: "Push day",
      target_duration_min: 60,
      muscle_focus: "chest, triceps",
    }));
    const targets = state.byTable["planned_workouts"].rows[0].targets as Record<string, unknown>;
    expect(targets.muscle_focus).toBe("chest, triceps");
  });

  it("returns 200 with the new planned_workout id", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Easy",
      target_duration_min: 30,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toMatch(/^id-/);
  });
});

describe("POST /api/plan/sessions — structured intervals", () => {
  it("stores leaf steps in contract.steps", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Warmup → tempo",
      target_duration_min: 50,
      steps: [
        { type: "warmup", duration_sec: 600, target_hr_zone: 2 },
        { type: "work", duration_sec: 1200, target_hr_zone: 4, label: "Tempo" },
        { type: "cooldown", duration_sec: 600, target_hr_zone: 2 },
      ],
    }));
    expect(res.status).toBe(200);
    const contract = (state.byTable["planned_workouts"].rows[0].targets as Record<string, unknown>).contract as Record<string, unknown>;
    const steps = contract.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ type: "warmup", duration_sec: 600, target_hr_zone: 2 });
    expect(steps[1]).toMatchObject({ type: "work", duration_sec: 1200, target_hr_zone: 4, label: "Tempo" });
    expect(steps[2]).toMatchObject({ type: "cooldown", duration_sec: 600, target_hr_zone: 2 });
  });

  it("preserves single-level repeat blocks with their children", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "4x800 @ 5K",
      target_duration_min: 35,
      steps: [
        { type: "warmup", duration_sec: 600 },
        {
          type: "repeat", repeats: 4, label: "5K reps",
          steps: [
            { type: "work", distance_m: 800, target_hr_zone: 4 },
            { type: "recovery", duration_sec: 120, target_hr_zone: 2 },
          ],
        },
        { type: "cooldown", duration_sec: 300 },
      ],
    }));
    expect(res.status).toBe(200);
    const contract = (state.byTable["planned_workouts"].rows[0].targets as Record<string, unknown>).contract as Record<string, unknown>;
    const steps = contract.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(3);
    const repeatBlock = steps[1];
    expect(repeatBlock.type).toBe("repeat");
    expect(repeatBlock.repeats).toBe(4);
    expect(repeatBlock.label).toBe("5K reps");
    const children = repeatBlock.steps as Array<Record<string, unknown>>;
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ type: "work", distance_m: 800, target_hr_zone: 4 });
    expect(children[1]).toMatchObject({ type: "recovery", duration_sec: 120, target_hr_zone: 2 });
  });

  it("rejects an unknown leaf-step type", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Bad",
      target_duration_min: 30,
      steps: [{ type: "sprint", duration_sec: 60 }],
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a repeat block with no children", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Empty repeat",
      target_duration_min: 30,
      steps: [{ type: "repeat", repeats: 4, steps: [] }],
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a repeat with repeats < 1", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Zero repeat",
      target_duration_min: 30,
      steps: [{ type: "repeat", repeats: 0, steps: [{ type: "work", duration_sec: 60 }] }],
    }));
    expect(res.status).toBe(400);
  });

  it("rejects an HR zone outside 1..5", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "run", session_type: "Bad zone",
      target_duration_min: 30,
      steps: [{ type: "work", duration_sec: 60, target_hr_zone: 6 }],
    }));
    expect(res.status).toBe(400);
  });

  it("preserves strength-specific fields on leaf steps", async () => {
    const { POST } = await import("@/app/api/plan/sessions/route");
    const res = await POST(jsonReq({
      date: "2026-05-20", sport: "strength", session_type: "Push day",
      target_duration_min: 60,
      steps: [
        { type: "work", exercise_name: "Bench Press", sets: 3, reps: 8, weight_kg: 60, rpe: 7 },
      ],
    }));
    expect(res.status).toBe(200);
    const contract = (state.byTable["planned_workouts"].rows[0].targets as Record<string, unknown>).contract as Record<string, unknown>;
    const steps = contract.steps as Array<Record<string, unknown>>;
    expect(steps[0]).toMatchObject({
      type: "work",
      exercise_name: "Bench Press",
      sets: 3,
      reps: 8,
      weight_kg: 60,
      rpe: 7,
    });
  });
});
