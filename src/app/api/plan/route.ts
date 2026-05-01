import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get("weekOffset") || "0", 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: plan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) {
    return NextResponse.json({ plan: null, workouts: [], completions: {} });
  }

  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("plan_id", plan.id)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date");

  const { data: workoutLogs } = await supabase
    .from("workout_logs")
    .select("date, name, duration_minutes, exercises")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  const { data: cardioLogs } = await supabase
    .from("cardio_logs")
    .select("date, type, distance, duration, avg_hr, pace_or_speed, calories")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  const todayStr = now.toISOString().slice(0, 10);
  const { data: todayRecovery } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours, resting_hr, body_battery")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  const completions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }> = {};

  for (const log of workoutLogs || []) {
    if (!completions[log.date]) completions[log.date] = {};
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    completions[log.date].workout = {
      name: log.name,
      duration_minutes: log.duration_minutes,
      exercise_count: exercises.length,
    };
  }

  for (const log of cardioLogs || []) {
    if (!completions[log.date]) completions[log.date] = {};
    if (!completions[log.date].cardio) completions[log.date].cardio = [];
    completions[log.date].cardio!.push({
      type: log.type,
      distance: log.distance,
      duration: log.duration,
      avg_hr: log.avg_hr,
      pace_or_speed: log.pace_or_speed,
    });
  }

  const planStart = new Date(plan.created_at);
  const weekNumber = Math.floor((weekStart.getTime() - planStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  return NextResponse.json({
    plan: {
      id: plan.id,
      split_type: plan.split_type,
      body_goal: plan.body_goal,
      race_type: plan.race_type,
      plan_config: plan.plan_config,
      created_at: plan.created_at,
    },
    workouts: workouts || [],
    completions,
    recovery: todayRecovery,
    weekStart: startStr,
    weekEnd: endStr,
    weekNumber,
  });
}
