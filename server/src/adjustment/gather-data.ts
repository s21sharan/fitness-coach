import { supabase } from "../db.js";

interface PlannedWorkout {
  session_type: string;
  status: string;
}

export function computeCompliance(planned: PlannedWorkout[]): number {
  const nonRest = planned.filter((p) => p.session_type !== "Rest");
  if (nonRest.length === 0) return 100;
  const completed = nonRest.filter((p) => p.status === "completed");
  return Math.round((completed.length / nonRest.length) * 100);
}

export interface WeekData {
  planned: Array<{ date: string; session_type: string; status: string; day_of_week: number }>;
  workoutLogs: Array<{ date: string; name: string; duration_minutes: number; exercises: unknown }>;
  cardioLogs: Array<{ date: string; type: string; distance: number; duration: number; avg_hr: number | null }>;
  nutritionLogs: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number }>;
  recoveryLogs: Array<{ date: string; hrv: number | null; sleep_hours: number | null; resting_hr: number | null; body_battery: number | null; stress_level: number | null }>;
  compliance: number;
  avgCalories: number;
  avgProtein: number;
  avgSleepHours: number | null;
  avgHrv: number | null;
}

export async function gatherWeekData(userId: string, planId: string, weekStartDate: string): Promise<WeekData> {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const [plannedRes, workoutRes, cardioRes, nutritionRes, recoveryRes] = await Promise.all([
    supabase
      .from("planned_workouts")
      .select("date, session_type, status, day_of_week")
      .eq("plan_id", planId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("workout_logs")
      .select("date, name, duration_minutes, exercises")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration, avg_hr")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("nutrition_logs")
      .select("date, calories, protein, carbs, fat")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("recovery_logs")
      .select("date, hrv, sleep_hours, resting_hr, body_battery, stress_level")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
  ]);

  const planned = plannedRes.data || [];
  const workoutLogs = workoutRes.data || [];
  const cardioLogs = cardioRes.data || [];
  const nutritionLogs = nutritionRes.data || [];
  const recoveryLogs = recoveryRes.data || [];

  // Mark planned workouts as completed if matching logs exist
  const workoutDates = new Set(workoutLogs.map((w) => w.date));
  const cardioDates = new Set(cardioLogs.map((c) => c.date));

  for (const p of planned) {
    if (p.session_type === "Rest") continue;
    const isLifting = !p.session_type.toLowerCase().includes("run") &&
                      !p.session_type.toLowerCase().includes("ride") &&
                      !p.session_type.toLowerCase().includes("swim");
    if (isLifting && workoutDates.has(p.date)) p.status = "completed";
    if (!isLifting && cardioDates.has(p.date)) p.status = "completed";
    if (p.session_type.includes("+")) {
      if (workoutDates.has(p.date) || cardioDates.has(p.date)) p.status = "completed";
    }
  }

  const compliance = computeCompliance(planned);

  const avgCalories = nutritionLogs.length > 0
    ? Math.round(nutritionLogs.reduce((s, n) => s + n.calories, 0) / nutritionLogs.length)
    : 0;

  const avgProtein = nutritionLogs.length > 0
    ? Math.round(nutritionLogs.reduce((s, n) => s + n.protein, 0) / nutritionLogs.length)
    : 0;

  const sleepEntries = recoveryLogs.filter((r) => r.sleep_hours !== null);
  const avgSleepHours = sleepEntries.length > 0
    ? Math.round(sleepEntries.reduce((s, r) => s + r.sleep_hours!, 0) / sleepEntries.length * 10) / 10
    : null;

  const hrvEntries = recoveryLogs.filter((r) => r.hrv !== null);
  const avgHrv = hrvEntries.length > 0
    ? Math.round(hrvEntries.reduce((s, r) => s + r.hrv!, 0) / hrvEntries.length)
    : null;

  return {
    planned,
    workoutLogs,
    cardioLogs,
    nutritionLogs,
    recoveryLogs,
    compliance,
    avgCalories,
    avgProtein,
    avgSleepHours,
    avgHrv,
  };
}
