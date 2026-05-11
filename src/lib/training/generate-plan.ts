import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { planGenerationSchema, type PlanGeneration, type DayLayout } from "./schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt, type RecentActivity } from "./prompts";

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
    supabase.from("cardio_logs").select("type, distance, duration, avg_hr").eq("user_id", userId).gte("date", since),
    supabase.from("workout_logs").select("duration_minutes").eq("user_id", userId).gte("date", since),
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
    recentActivity: null,
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

  // Generate 4 weeks starting next Monday
  const nextMonday = getNextMonday();
  const workouts = generatePlannedWorkouts(newPlan.id, plan.weekly_layout, nextMonday, 4);

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts);

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
