"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import type { OnboardingData } from "@/lib/onboarding/types";

export async function saveOnboardingData(data: OnboardingData) {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const supabase = createServerClient();

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      height: data.height,
      weight: data.weight,
      age: data.age,
      sex: data.sex,
      training_experience: data.experience,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    console.error("Failed to save profile:", profileError);
    return { success: false, error: "Failed to save profile" };
  }

  const { error: goalsError } = await supabase.from("user_goals").upsert(
    {
      user_id: userId,
      body_goal: data.bodyGoal!,
      body_goal_other: data.bodyGoalOther || null,
      emphasis: data.emphasis,
      training_for_race: data.trainingForRace,
      race_type: data.raceType,
      race_type_other: data.raceTypeOther || null,
      race_date: data.raceDate,
      goal_time: data.goalTime,
      does_cardio: data.doesCardio,
      cardio_types: data.cardioTypes.length > 0 ? data.cardioTypes : null,
      days_per_week: data.daysPerWeek!,
      lifting_days: data.liftingDays,
    },
    { onConflict: "user_id" }
  );

  if (goalsError) {
    console.error("Failed to save goals:", goalsError);
    return { success: false, error: "Failed to save goals" };
  }

  const { error: userError } = await supabase
    .from("users")
    .update({ onboarding_completed: true })
    .eq("id", userId);

  if (userError) {
    console.error("Failed to update user:", userError);
    return { success: false, error: "Failed to update user" };
  }

  return { success: true };
}
