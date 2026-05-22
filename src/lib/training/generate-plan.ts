import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { planGenerationSchema, type PlanGeneration, type DayLayout, type MultiWeekPlan, type SessionContract, type WeekBlock, multiWeekPlanSchema } from "./schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt, type RecentActivity, MULTI_WEEK_SYSTEM_PROMPT, buildMultiWeekUserPrompt, type MultiWeekPromptContext } from "./prompts";
import { estimateDurationMin, type WorkoutContractV1, type ContractStep, type PlannedWorkoutTargets } from "./workout-contract";
import { getNextBlockType, blockTypeLabel } from "./phase-rules";
import { createBlock } from "./blocks";

interface GeneratePlanInput {
  userId: string;
  profile: {
    age: number | null;
    height: number | null;
    weight: number | null;
    sex: string | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number;
    lifting_days: number | null;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
    does_cardio: boolean;
    cardio_types: string[] | null;
  };
}

export function generatePlannedWorkouts(
  planId: string,
  layout: DayLayout[],
  startDate: Date,
  weeks: number,
): Array<{
  plan_id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: DayLayout["targets"] | null;
  status: string;
  approved: boolean;
}> {
  const workouts: Array<{
    plan_id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    targets: DayLayout["targets"] | null;
    status: string;
    approved: boolean;
  }> = [];

  for (let week = 0; week < weeks; week++) {
    for (const day of layout) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + week * 7 + day.day_of_week);
      const dateStr = date.toISOString().slice(0, 10);

      workouts.push({
        plan_id: planId,
        date: dateStr,
        day_of_week: day.day_of_week,
        session_type: day.session_type,
        ai_notes: day.ai_notes,
        targets: day.targets || null,
        status: "scheduled",
        approved: true,
      });
    }
  }

  return workouts;
}

export async function getRecentActivityStats(userId: string): Promise<RecentActivity | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const [cardioRes, workoutRes, recoveryRes] = await Promise.all([
    supabase.from("cardio_logs").select("type, distance, duration, avg_hr").eq("user_id", userId).eq("is_suppressed", false).gte("date", since),
    supabase.from("workout_logs").select("duration_minutes").eq("user_id", userId).eq("is_suppressed", false).gte("date", since),
    supabase.from("recovery_logs").select("hrv, sleep_hours").eq("user_id", userId).gte("date", since),
  ]);

  const cardio = cardioRes.data || [];
  const workouts = workoutRes.data || [];
  const recovery = recoveryRes.data || [];

  if (cardio.length === 0 && workouts.length === 0 && recovery.length === 0) return null;

  const runs = cardio.filter((c) => c.type === "run");
  const runsWithDist = runs.filter((r) => r.distance > 0);
  const weeks = 30 / 7;

  return {
    avgRunPaceMinKm: runsWithDist.length > 0 ? Math.round(runsWithDist.reduce((s, r) => s + r.duration / 60 / r.distance, 0) / runsWithDist.length * 10) / 10 : null,
    avgRunDistanceKm: runs.length > 0 ? Math.round(runs.reduce((s, r) => s + (r.distance || 0), 0) / runs.length * 10) / 10 : null,
    avgRunHr: runs.filter((r) => r.avg_hr).length > 0 ? Math.round(runs.filter((r) => r.avg_hr).reduce((s, r) => s + r.avg_hr!, 0) / runs.filter((r) => r.avg_hr).length) : null,
    weeklyRunCount: Math.round(runs.length / weeks * 10) / 10,
    weeklyLiftCount: Math.round(workouts.length / weeks * 10) / 10,
    avgLiftDurationMin: workouts.length > 0 ? Math.round(workouts.reduce((s, w) => s + (w.duration_minutes || 0), 0) / workouts.length) : null,
    avgHrv: recovery.filter((r) => r.hrv).length > 0 ? Math.round(recovery.filter((r) => r.hrv).reduce((s, r) => s + r.hrv!, 0) / recovery.filter((r) => r.hrv).length) : null,
    avgSleepHours: recovery.filter((r) => r.sleep_hours).length > 0 ? Math.round(recovery.filter((r) => r.sleep_hours).reduce((s, r) => s + r.sleep_hours!, 0) / recovery.filter((r) => r.sleep_hours).length * 10) / 10 : null,
  };
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<{
  plan: PlanGeneration;
  planId: string;
}> {
  const recentActivity = await getRecentActivityStats(input.userId);

  const userPrompt = buildUserPrompt({
    age: input.profile.age,
    height: input.profile.height,
    weight: input.profile.weight,
    sex: input.profile.sex,
    experience: input.profile.training_experience,
    bodyGoal: input.goals.body_goal,
    emphasis: input.goals.emphasis,
    daysPerWeek: input.goals.days_per_week,
    liftingDays: input.goals.lifting_days,
    trainingForRace: input.goals.training_for_race,
    raceType: input.goals.race_type,
    raceDate: input.goals.race_date,
    goalTime: input.goals.goal_time,
    doesCardio: input.goals.does_cardio,
    cardioTypes: input.goals.cardio_types || [],
    recentActivity,
  });

  const { object: plan } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: planGenerationSchema,
    system: PLAN_SYSTEM_PROMPT,
    prompt: userPrompt,
    // jsonTool avoids the strict structured-output grammar limit (≤24 optional
    // params) that the default "auto" mode enforces — our contract schema
    // flattens to far more optional fields than that.
    providerOptions: { anthropic: { structuredOutputMode: "jsonTool" } },
  });

  const supabase = createServerClient();

  // Deactivate existing active plan
  await supabase
    .from("training_plans")
    .update({ status: "completed" })
    .eq("user_id", input.userId)
    .eq("status", "active");

  // Insert new plan
  const { data: newPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: input.userId,
      split_type: plan.split_type,
      body_goal: input.goals.body_goal,
      race_type: input.goals.race_type,
      status: "active",
      plan_config: plan.plan_config as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (planError || !newPlan) throw new Error("Failed to create training plan");

  // Determine initial block type from phase rules
  const blockType = getNextBlockType({
    raceDate: input.goals.race_date,
    currentBlockType: null,
    blockNumber: 0,
  });

  const weekCount = plan.plan_config?.deload_frequency || 4;
  const nextMonday = getNextMonday();
  const endDate = new Date(nextMonday);
  endDate.setDate(endDate.getDate() + weekCount * 7 - 1);

  // Create the initial block
  const block = await createBlock({
    planId: newPlan.id,
    blockNumber: 1,
    blockType,
    blockLabel: `${blockTypeLabel(blockType)} Block`,
    weekCount,
    startDate: nextMonday.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    status: "active",
    generationContext: {
      source: "onboarding",
      raceDate: input.goals.race_date,
    },
  });

  // Generate workouts for the block duration
  const workouts = generatePlannedWorkouts(newPlan.id, plan.weekly_layout, nextMonday, weekCount);

  // Set block_id on all workouts
  const workoutsWithBlock = workouts.map((w) => ({ ...w, block_id: block.id }));

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workoutsWithBlock);

  if (workoutsError) throw new Error("Failed to create planned workouts");

  return { plan, planId: newPlan.id };
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const DAY_LABEL_TO_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/**
 * Merge AM and PM session contracts into a single `planned_workouts` row payload.
 * - session_type: "AM: <am.name> · PM: <pm.name>" when both, otherwise the single name.
 * - targets.contract: when both slots exist, steps are prefixed and concatenated.
 * Returns null targets for rest days.
 */
export function combineSessionContracts(opts: {
  am?: SessionContract | null;
  pm?: SessionContract | null;
  is_rest?: boolean;
  notes?: string | null;
}): { session_type: string; ai_notes: string | null; targets: PlannedWorkoutTargets | null } {
  const { am, pm, is_rest, notes } = opts;
  if (is_rest || (!am && !pm)) {
    return { session_type: "Rest", ai_notes: notes ?? null, targets: null };
  }

  const parts: string[] = [];
  const rationales: string[] = [];
  if (am) {
    parts.push(`AM: ${am.name}`);
    if (am.rationale) rationales.push(`AM — ${am.rationale}`);
  }
  if (pm) {
    parts.push(`PM: ${pm.name}`);
    if (pm.rationale) rationales.push(`PM — ${pm.rationale}`);
  }
  const session_type = parts.length > 1 ? parts.join(" · ") : (am?.name ?? pm?.name ?? "Rest");
  const ai_notes = rationales.length > 0 ? rationales.join("\n") : notes ?? null;

  let contract: WorkoutContractV1 | null = null;
  if (am && pm) {
    const prefixSteps = (steps: ContractStep[], prefix: string): ContractStep[] =>
      steps.map((s) => ({ ...s, label: s.label ? `${prefix} ${s.label}` : `${prefix} work` }));
    contract = {
      version: 1,
      sport: am.contract.sport, // primary sport — am leads
      name: session_type.length > 80 ? `${session_type.slice(0, 77)}…` : session_type,
      slot: "full",
      source: am.contract.source,
      steps: [
        ...prefixSteps(am.contract.steps as ContractStep[], "AM —"),
        ...prefixSteps(pm.contract.steps as ContractStep[], "PM —"),
      ],
    };
  } else if (am) {
    contract = { ...(am.contract as unknown as WorkoutContractV1), slot: am.contract.slot ?? "am" };
  } else if (pm) {
    contract = { ...(pm.contract as unknown as WorkoutContractV1), slot: pm.contract.slot ?? "pm" };
  }

  const targets: PlannedWorkoutTargets | null = contract
    ? {
        contract,
        target_duration_min: estimateDurationMin(contract.steps),
      }
    : null;

  return { session_type, ai_notes, targets };
}

export function expandBlocksToWorkouts(
  planId: string,
  blocks: WeekBlock[],
  startDate: Date,
): Array<{
  plan_id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: Record<string, unknown> | null;
  status: string;
  approved: boolean;
}> {
  const workouts: Array<{
    plan_id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    targets: Record<string, unknown> | null;
    status: string;
    approved: boolean;
  }> = [];

  for (const block of blocks) {
    const weekOffset = block.week_number - 1;
    for (const day of block.days) {
      const dayIdx = DAY_LABEL_TO_INDEX[day.day_label] ?? 0;
      const date = new Date(startDate);
      date.setDate(date.getDate() + weekOffset * 7 + dayIdx);
      const dateStr = date.toISOString().slice(0, 10);

      const { session_type, ai_notes, targets } = combineSessionContracts({
        am: day.am_session,
        pm: day.pm_session,
        is_rest: day.is_rest,
        notes: day.notes,
      });

      workouts.push({
        plan_id: planId,
        date: dateStr,
        day_of_week: dayIdx,
        session_type,
        ai_notes,
        targets: targets as Record<string, unknown> | null,
        status: "scheduled",
        approved: true,
      });
    }
  }

  return workouts;
}

export interface GenerateMultiWeekInput {
  userId: string;
  profile: {
    age: number | null;
    height: number | null;
    weight: number | null;
    sex: string | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number;
    lifting_days: number | null;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
    does_cardio: boolean;
    cardio_types: string[] | null;
  };
  weeks: number;
  compliance: string | null;
  userRequest?: string;
  /**
   * Pre-rendered durable-facts block. Pass null/undefined to skip — the
   * planner will still receive the rest of the context. Callers should
   * fetch via `fetchActiveFacts(userId)` and render via
   * `formatFactsForPlanPrompt(facts)` so we don't duplicate that logic.
   */
  factsBlock?: string | null;
  /**
   * Eval/test injection point. When provided, the planner skips the
   * Supabase fetch for recent activity and uses these stats directly.
   * Production callers should leave this undefined.
   */
  overrideRecentActivity?: RecentActivity | null;
}

export async function generateMultiWeekPlan(input: GenerateMultiWeekInput): Promise<MultiWeekPlan> {
  const recentActivity = input.overrideRecentActivity !== undefined
    ? input.overrideRecentActivity
    : await getRecentActivityStats(input.userId);

  const ctx: MultiWeekPromptContext = {
    age: input.profile.age,
    height: input.profile.height,
    weight: input.profile.weight,
    sex: input.profile.sex,
    experience: input.profile.training_experience,
    bodyGoal: input.goals.body_goal,
    emphasis: input.goals.emphasis,
    daysPerWeek: input.goals.days_per_week,
    liftingDays: input.goals.lifting_days,
    trainingForRace: input.goals.training_for_race,
    raceType: input.goals.race_type,
    raceDate: input.goals.race_date,
    goalTime: input.goals.goal_time,
    doesCardio: input.goals.does_cardio,
    cardioTypes: input.goals.cardio_types || [],
    recentActivity,
    compliance: input.compliance,
    weeksToGenerate: input.weeks,
    factsBlock: input.factsBlock ?? null,
  };

  let prompt = buildMultiWeekUserPrompt(ctx);

  if (input.userRequest) {
    prompt += `\n\nThe user specifically requested: ${input.userRequest}`;
  }

  const { object: plan } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: multiWeekPlanSchema,
    system: MULTI_WEEK_SYSTEM_PROMPT,
    prompt,
    // jsonTool avoids the strict structured-output grammar limit (≤24 optional
    // params) that the default "auto" mode enforces — our contract schema
    // flattens to far more optional fields than that.
    providerOptions: { anthropic: { structuredOutputMode: "jsonTool" } },
  });

  return plan;
}
