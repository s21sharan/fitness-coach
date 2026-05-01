import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function calculateReadiness(hrv: number | null, sleepHours: number | null, bodyBattery: number | null): "good" | "fair" | "low" {
  if ((hrv !== null && hrv >= 50) || (bodyBattery !== null && bodyBattery >= 60) || (sleepHours !== null && sleepHours >= 7)) {
    return "good";
  }
  if ((hrv !== null && hrv >= 35) || (bodyBattery !== null && bodyBattery >= 40) || (sleepHours !== null && sleepHours >= 6)) {
    return "fair";
  }
  return "low";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Get active plan
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  // Today's session
  let todaySession: { date: string; session_type: string | null; ai_notes: string | null } = {
    date: todayStr,
    session_type: null,
    ai_notes: null,
  };

  let weekWorkouts: unknown[] = [];

  if (plan) {
    const { data: todayWorkout } = await supabase
      .from("planned_workouts")
      .select("session_type, ai_notes")
      .eq("plan_id", plan.id)
      .eq("date", todayStr)
      .single();

    if (todayWorkout) {
      todaySession.session_type = todayWorkout.session_type;
      todaySession.ai_notes = todayWorkout.ai_notes;
    }

    const { data: workouts } = await supabase
      .from("planned_workouts")
      .select("id, date, day_of_week, session_type, ai_notes, status, approved")
      .eq("plan_id", plan.id)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
      .order("date");

    weekWorkouts = workouts || [];
  }

  // Week completions
  const [workoutLogsRes, cardioLogsRes] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("date, name, duration_minutes, exercises")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration, avg_hr, pace_or_speed")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
  ]);

  const weekCompletions: Record<string, Record<string, unknown>> = {};
  for (const log of workoutLogsRes.data || []) {
    if (!weekCompletions[log.date]) weekCompletions[log.date] = {};
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    weekCompletions[log.date].workout = {
      name: log.name,
      duration_minutes: log.duration_minutes,
      exercise_count: exercises.length,
    };
  }
  for (const log of cardioLogsRes.data || []) {
    if (!weekCompletions[log.date]) weekCompletions[log.date] = {};
    if (!weekCompletions[log.date].cardio) weekCompletions[log.date].cardio = [];
    (weekCompletions[log.date].cardio as unknown[]).push({
      type: log.type,
      distance: log.distance,
      duration: log.duration,
      avg_hr: log.avg_hr,
      pace_or_speed: log.pace_or_speed,
    });
  }

  // Today's nutrition
  const { data: todayNutrition } = await supabase
    .from("nutrition_logs")
    .select("calories, protein")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  // 7-day calorie average for target
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const { data: recentNutrition } = await supabase
    .from("nutrition_logs")
    .select("calories")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgo.toISOString().slice(0, 10))
    .lt("date", todayStr);

  let targetCalories = 2000;
  if (recentNutrition && recentNutrition.length > 0) {
    targetCalories = Math.round(recentNutrition.reduce((s, n) => s + n.calories, 0) / recentNutrition.length);
  }

  // Today's recovery
  const { data: todayRecovery } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours, body_battery")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  // Weight
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("weight")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({
    today: todaySession,
    weekWorkouts,
    weekCompletions,
    weekStart: weekStartStr,
    nutrition: todayNutrition ? {
      calories: todayNutrition.calories,
      protein: todayNutrition.protein,
      target_calories: targetCalories,
    } : null,
    recovery: todayRecovery ? {
      hrv: todayRecovery.hrv,
      sleep_hours: todayRecovery.sleep_hours,
      body_battery: todayRecovery.body_battery,
      readiness: calculateReadiness(todayRecovery.hrv, todayRecovery.sleep_hours, todayRecovery.body_battery),
    } : null,
    weight: {
      current: profile?.weight || null,
      direction: "stable" as const,
    },
  });
}
