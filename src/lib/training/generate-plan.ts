import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { planGenerationSchema, type PlanGeneration, type DayLayout, type MultiWeekPlan, type WeekBlock, multiWeekPlanSchema } from "./schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt, type RecentActivity, MULTI_WEEK_SYSTEM_PROMPT, buildMultiWeekUserPrompt, type MultiWeekPromptContext } from "./prompts";
import { combineDaySessions } from "./seed-plan-from-onboarding";
import type { PlanPreviewDay } from "@/lib/onboarding/types";
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
    model: anthropic("claude-sonnet-4-20250514"),
    schema: planGenerationSchema,
    system: PLAN_SYSTEM_PROMPT,
    prompt: userPrompt,
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

      const previewDay: PlanPreviewDay = {
        day_label: day.day_label,
        am_session: day.am_session,
        am_rationale: day.am_rationale,
        pm_session: day.pm_session,
        pm_rationale: day.pm_rationale,
        is_rest: day.is_rest,
        notes: day.notes,
      };
      const { session_type, ai_notes, targets } = combineDaySessions(previewDay);

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
}

export async function generateMultiWeekPlan(input: GenerateMultiWeekInput): Promise<MultiWeekPlan> {
  const recentActivity = await getRecentActivityStats(input.userId);

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
  };

  let prompt = buildMultiWeekUserPrompt(ctx);

  if (input.userRequest) {
    prompt += `\n\nThe user specifically requested: ${input.userRequest}`;
  }

  const { object: plan } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: multiWeekPlanSchema,
    system: MULTI_WEEK_SYSTEM_PROMPT,
    prompt,
  });

  return plan;
}
