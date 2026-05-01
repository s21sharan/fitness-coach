"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/training/generate-plan";
import type { OnboardingData } from "@/lib/onboarding/types";

export async function generatePlanFromOnboarding(data: OnboardingData) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  try {
    const { plan, planId } = await generateTrainingPlan({
      userId,
      profile: {
        age: data.age,
        height: data.height,
        weight: data.weight,
        sex: data.sex,
        training_experience: data.experience,
      },
      goals: {
        body_goal: data.bodyGoal!,
        emphasis: data.emphasis,
        days_per_week: data.daysPerWeek!,
        lifting_days: data.liftingDays,
        training_for_race: data.trainingForRace,
        race_type: data.raceType,
        race_date: data.raceDate,
        goal_time: data.goalTime,
        does_cardio: data.doesCardio,
        cardio_types: data.cardioTypes,
      },
    });

    return {
      success: true,
      plan: {
        id: planId,
        split_type: plan.split_type,
        reasoning: plan.reasoning,
        weekly_layout: plan.weekly_layout,
        plan_config: plan.plan_config,
      },
    };
  } catch (err) {
    console.error("Plan generation failed:", err);
    return { success: false, error: "Failed to generate training plan" };
  }
}

export async function regeneratePlan() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile || !goals) {
    return { success: false, error: "Profile or goals not found" };
  }

  try {
    const { plan, planId } = await generateTrainingPlan({
      userId,
      profile: {
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        sex: profile.sex,
        training_experience: profile.training_experience,
      },
      goals: {
        body_goal: goals.body_goal,
        emphasis: goals.emphasis,
        days_per_week: goals.days_per_week,
        lifting_days: goals.lifting_days,
        training_for_race: goals.training_for_race,
        race_type: goals.race_type,
        race_date: goals.race_date,
        goal_time: goals.goal_time,
        does_cardio: goals.does_cardio,
        cardio_types: goals.cardio_types,
      },
    });

    return {
      success: true,
      plan: {
        id: planId,
        split_type: plan.split_type,
        reasoning: plan.reasoning,
        weekly_layout: plan.weekly_layout,
        plan_config: plan.plan_config,
      },
    };
  } catch (err) {
    console.error("Plan regeneration failed:", err);
    return { success: false, error: "Failed to regenerate training plan" };
  }
}
