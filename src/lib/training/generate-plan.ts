import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServerClient } from "@/lib/supabase/server";
import { planGenerationSchema, type PlanGeneration, type DayLayout } from "./schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "./prompts";

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
  status: string;
  approved: boolean;
}> {
  const workouts: Array<{
    plan_id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
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
        status: "scheduled",
        approved: true,
      });
    }
  }

  return workouts;
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
