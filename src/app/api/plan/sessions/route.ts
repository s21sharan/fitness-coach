import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertDateNotPast } from "@/lib/training/date-guards";
import type { ContractStep, ContractStepType } from "@/lib/training/workout-contract";

// User-initiated planned session creation — the manual counterpart to the
// AI coach's create_planned_workouts_batch tool. Inserts ONE planned_workouts
// row into the user's active plan. The session participates in matching like
// any coach-planned session when synced actuals come in.

type Sport = "run" | "bike" | "swim" | "strength" | "other";
type Slot = "am" | "pm" | "full";

const SPORTS: readonly Sport[] = ["run", "bike", "swim", "strength", "other"];
const SLOTS: readonly Slot[] = ["am", "pm", "full"];
const LEAF_STEP_TYPES: readonly ContractStepType[] = [
  "warmup", "work", "recovery", "cooldown", "rest",
];

interface Body {
  date: string;                       // YYYY-MM-DD
  sport: Sport;
  session_type: string;               // user-visible name, e.g. "Easy Z2 run"
  slot?: Slot;
  ai_notes?: string | null;
  target_duration_min?: number | null;
  target_distance_km?: number | null;
  target_pace_min_km?: number | null;
  target_hr_zone?: number | null;
  target_hr_max?: number | null;
  muscle_focus?: string | null;
  /**
   * Optional structured intervals. Single level of repeat nesting supported:
   * a top-level step may be type="repeat" with its own `steps` array of leaf
   * steps. Leaf steps inside repeats may NOT themselves be repeats.
   */
  steps?: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

function nullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

// Optional numeric field that, if present, must be a finite non-negative
// number. Returns undefined when the input is missing/null so we can omit
// the key entirely from the contract step (cleaner JSON for downstream
// consumers).
function optPositiveNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
    throw new Error("numeric field must be a finite number ≥ 0");
  }
  return v;
}

function optHrZone(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  if (v == null) return undefined;
  if (v !== 1 && v !== 2 && v !== 3 && v !== 4 && v !== 5) {
    throw new Error("target_hr_zone must be 1..5");
  }
  return v;
}

function optString(v: unknown, max = 200): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== "string") throw new Error("string field expected");
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  return trimmed.slice(0, max);
}

function buildLeafStep(raw: unknown): ContractStep {
  if (!raw || typeof raw !== "object") throw new Error("step must be an object");
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== "string" || !LEAF_STEP_TYPES.includes(type as ContractStepType)) {
    throw new Error(`step.type must be one of ${LEAF_STEP_TYPES.join("|")}`);
  }
  const step: ContractStep = { type: type as ContractStepType };
  const label = optString(r.label, 80);
  if (label) step.label = label;
  const duration = optPositiveNumber(r.duration_sec);
  if (duration !== undefined) step.duration_sec = Math.round(duration);
  const distance = optPositiveNumber(r.distance_m);
  if (distance !== undefined) step.distance_m = Math.round(distance);
  const zone = optHrZone(r.target_hr_zone);
  if (zone !== undefined) step.target_hr_zone = zone;
  const pace = optPositiveNumber(r.pace_sec_per_km);
  if (pace !== undefined) step.pace_sec_per_km = Math.round(pace);
  const ftp = optPositiveNumber(r.ftp_percent);
  if (ftp !== undefined) step.ftp_percent = Math.round(ftp);
  const exerciseName = optString(r.exercise_name, 80);
  if (exerciseName) step.exercise_name = exerciseName;
  const sets = optPositiveNumber(r.sets);
  if (sets !== undefined) step.sets = Math.round(sets);
  const reps = optPositiveNumber(r.reps);
  if (reps !== undefined) step.reps = Math.round(reps);
  const weight = optPositiveNumber(r.weight_kg);
  if (weight !== undefined) step.weight_kg = Math.round(weight * 100) / 100;
  const rpe = optPositiveNumber(r.rpe);
  if (rpe !== undefined) step.rpe = rpe;
  return step;
}

function buildSteps(raw: unknown): ContractStep[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new Error("steps must be an array");
  if (raw.length > 60) throw new Error("steps may not exceed 60 entries");
  const out: ContractStep[] = [];
  for (const blockRaw of raw) {
    if (!blockRaw || typeof blockRaw !== "object") {
      throw new Error("each step must be an object");
    }
    const block = blockRaw as Record<string, unknown>;
    if (block.type === "repeat") {
      const repeats = optPositiveNumber(block.repeats);
      if (!repeats || repeats < 1) throw new Error("repeat.repeats must be ≥ 1");
      if (!Array.isArray(block.steps) || block.steps.length === 0) {
        throw new Error("repeat must contain at least one step");
      }
      const children = block.steps.map(buildLeafStep);
      const repeatStep: ContractStep = {
        type: "repeat",
        repeats: Math.round(repeats),
        steps: children,
      };
      const label = optString(block.label, 80);
      if (label) repeatStep.label = label;
      out.push(repeatStep);
    } else {
      out.push(buildLeafStep(blockRaw));
    }
  }
  return out;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidDate(body.date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  // Same guardrail as plan/edit and the AI tools: no scheduling in the past.
  const guard = assertDateNotPast(body.date);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: 400 });

  if (!SPORTS.includes(body.sport)) {
    return NextResponse.json({ error: `sport must be one of ${SPORTS.join("|")}` }, { status: 400 });
  }
  if (typeof body.session_type !== "string" || body.session_type.trim() === "") {
    return NextResponse.json({ error: "session_type required" }, { status: 400 });
  }
  const slot: Slot = body.slot && SLOTS.includes(body.slot) ? body.slot : "full";

  let steps: ContractStep[];
  try {
    steps = buildSteps(body.steps);
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "invalid steps",
    }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: plan, error: planErr } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "No active training plan" }, { status: 404 });

  // day_of_week is stored Mon=0..Sun=6 (see plan/edit/route.ts).
  const jsDow = new Date(body.date + "T00:00:00").getDay();
  const dayOfWeek = jsDow === 0 ? 6 : jsDow - 1;

  // targets shape mirrors what the PlannedWorkoutModal display expects.
  // Including a minimal contract gives matchPlannedToActuals a reliable
  // sport signal (classifyPlanned looks at targets.contract.sport first).
  // Empty steps is intentional — the display falls back to "no structured
  // intervals attached" which is appropriate for a free-form manual entry.
  const targets: Record<string, unknown> = {
    contract: {
      version: 1,
      sport: body.sport,
      name: body.session_type.trim(),
      slot,
      source: "heuristic",
      steps,
    },
    target_distance_km: nullableNumber(body.target_distance_km),
    target_duration_min: nullableNumber(body.target_duration_min),
    target_pace_min_km: nullableNumber(body.target_pace_min_km),
    target_hr_zone: nullableNumber(body.target_hr_zone),
    target_hr_max: nullableNumber(body.target_hr_max),
    muscle_focus: body.muscle_focus && body.muscle_focus.trim() !== ""
      ? body.muscle_focus.trim()
      : null,
  };

  const row = {
    plan_id: plan.id,
    date: body.date,
    day_of_week: dayOfWeek,
    session_type: body.session_type.trim(),
    ai_notes: body.ai_notes && body.ai_notes.trim() !== "" ? body.ai_notes.trim() : null,
    targets,
    approved: true,
    status: "scheduled",
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("planned_workouts")
    .insert(row)
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json({ error: insertErr?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
