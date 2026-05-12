// ============================================================
// Pre-fill the "current load" onboarding screen from synced data.
//
// Reads from the same logs tables populated by the Phase 3 sync
// workers (Strava cardio_logs, Hevy workout_logs, Garmin
// recovery_logs, MacroFactor nutrition_logs).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface SportLoadSummary {
  weekly_avg: number;            // primary weekly metric (miles / hours / sessions)
  weekly_peak: number;           // peak week in window
  longest_session: number;       // max single session in window
  weeks_observed: number;        // how many weeks of data we have
  unit: "miles" | "hours" | "meters" | "sessions";
}

export interface NutritionSummary {
  avg_protein_g: number | null;
  avg_calories: number | null;
  days_observed: number;
}

export interface RecoverySummary {
  avg_sleep_hours: number | null;
  avg_hrv: number | null;
  avg_resting_hr: number | null;
  days_observed: number;
}

export interface AggregatedLoadSummary {
  windowDays: number;
  run: SportLoadSummary | null;
  bike: SportLoadSummary | null;
  swim: SportLoadSummary | null;
  lift: SportLoadSummary | null;
  nutrition: NutritionSummary | null;
  recovery: RecoverySummary | null;
  hasAnyData: boolean;
}

interface CardioRow {
  date: string;
  type: "run" | "bike" | "swim" | "other" | null;
  distance: number | null;       // assume km from Strava
  duration: number | null;       // seconds
}

interface WorkoutRow {
  date: string;
  duration_minutes: number | null;
}

interface RecoveryRow {
  date: string;
  sleep_hours: number | null;
  hrv: number | null;
  resting_hr: number | null;
}

interface NutritionRow {
  date: string;
  calories: number | null;
  protein: number | null;
}

export interface AggregateOptions {
  windowDays?: number;   // default 56 (8 weeks)
}

export async function aggregateAthleteLoad(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: AggregateOptions = {}
): Promise<AggregatedLoadSummary> {
  const windowDays = options.windowDays ?? 56;
  const since = new Date(Date.now() - windowDays * 86400000)
    .toISOString()
    .slice(0, 10);

  const [cardioRes, workoutRes, recoveryRes, nutritionRes] = await Promise.all([
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: false })
      .returns<CardioRow[]>(),
    supabase
      .from("workout_logs")
      .select("date, duration_minutes")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: false })
      .returns<WorkoutRow[]>(),
    supabase
      .from("recovery_logs")
      .select("date, sleep_hours, hrv, resting_hr")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: false })
      .returns<RecoveryRow[]>(),
    supabase
      .from("nutrition_logs")
      .select("date, calories, protein")
      .eq("user_id", userId)
      .gte("date", since)
      .order("date", { ascending: false })
      .returns<NutritionRow[]>(),
  ]);

  const cardio = cardioRes.data ?? [];
  const workouts = workoutRes.data ?? [];
  const recovery = recoveryRes.data ?? [];
  const nutrition = nutritionRes.data ?? [];

  const weeks = Math.max(1, Math.round(windowDays / 7));

  const run = summarizeCardio(cardio, "run", weeks, "miles");
  const bike = summarizeCardio(cardio, "bike", weeks, "hours");
  const swim = summarizeCardio(cardio, "swim", weeks, "meters");
  const lift = summarizeLifting(workouts, weeks);

  const nutritionSummary = summarizeNutrition(nutrition);
  const recoverySummary = summarizeRecovery(recovery);

  const hasAnyData =
    !!run || !!bike || !!swim || !!lift || !!nutritionSummary || !!recoverySummary;

  return {
    windowDays,
    run,
    bike,
    swim,
    lift,
    nutrition: nutritionSummary,
    recovery: recoverySummary,
    hasAnyData,
  };
}

// ------------------------------------------------------------
// Cardio summaries
// ------------------------------------------------------------

function summarizeCardio(
  rows: CardioRow[],
  sport: "run" | "bike" | "swim",
  weeks: number,
  unit: "miles" | "hours" | "meters"
): SportLoadSummary | null {
  const filtered = rows.filter((r) => r.type === sport);
  if (filtered.length === 0) return null;

  const weeklyTotals = bucketByWeek(filtered, (r) => toUnit(r, sport));
  if (weeklyTotals.length === 0) return null;

  const sum = weeklyTotals.reduce((s, w) => s + w, 0);
  const peak = Math.max(...weeklyTotals);
  const longest = Math.max(
    ...filtered.map((r) => toUnit(r, sport)).filter((v) => v > 0),
    0
  );

  return {
    weekly_avg: round1(sum / weeks),
    weekly_peak: round1(peak),
    longest_session: round1(longest),
    weeks_observed: weeklyTotals.length,
    unit,
  };
}

function toUnit(row: CardioRow, sport: "run" | "bike" | "swim"): number {
  const km = row.distance ?? 0;
  const seconds = row.duration ?? 0;
  if (sport === "run") return km * 0.621371;            // miles
  if (sport === "bike") return seconds / 3600;          // hours
  if (sport === "swim") return km * 1000;               // meters
  return 0;
}

// ------------------------------------------------------------
// Lifting summary (Hevy workout_logs)
// ------------------------------------------------------------

function summarizeLifting(rows: WorkoutRow[], weeks: number): SportLoadSummary | null {
  if (rows.length === 0) return null;
  const weeklyCounts = bucketByWeek(rows, () => 1);
  if (weeklyCounts.length === 0) return null;

  const sessions = rows.length;
  const peak = Math.max(...weeklyCounts);
  const longest = Math.max(
    ...rows.map((r) => (r.duration_minutes ?? 0) / 60),
    0
  );

  return {
    weekly_avg: round1(sessions / weeks),
    weekly_peak: peak,
    longest_session: round1(longest),
    weeks_observed: weeklyCounts.length,
    unit: "sessions",
  };
}

// ------------------------------------------------------------
// Nutrition
// ------------------------------------------------------------

function summarizeNutrition(rows: NutritionRow[]): NutritionSummary | null {
  if (rows.length === 0) return null;
  const proteinRows = rows.filter((r) => r.protein !== null);
  const calorieRows = rows.filter((r) => r.calories !== null);
  return {
    avg_protein_g:
      proteinRows.length === 0
        ? null
        : Math.round(
            proteinRows.reduce((s, r) => s + (r.protein ?? 0), 0) /
              proteinRows.length
          ),
    avg_calories:
      calorieRows.length === 0
        ? null
        : Math.round(
            calorieRows.reduce((s, r) => s + (r.calories ?? 0), 0) /
              calorieRows.length
          ),
    days_observed: rows.length,
  };
}

// ------------------------------------------------------------
// Recovery
// ------------------------------------------------------------

function summarizeRecovery(rows: RecoveryRow[]): RecoverySummary | null {
  if (rows.length === 0) return null;
  const sleepRows = rows.filter((r) => r.sleep_hours !== null);
  const hrvRows = rows.filter((r) => r.hrv !== null);
  const rhrRows = rows.filter((r) => r.resting_hr !== null);

  return {
    avg_sleep_hours:
      sleepRows.length === 0
        ? null
        : round1(
            sleepRows.reduce((s, r) => s + (r.sleep_hours ?? 0), 0) /
              sleepRows.length
          ),
    avg_hrv:
      hrvRows.length === 0
        ? null
        : Math.round(
            hrvRows.reduce((s, r) => s + (r.hrv ?? 0), 0) / hrvRows.length
          ),
    avg_resting_hr:
      rhrRows.length === 0
        ? null
        : Math.round(
            rhrRows.reduce((s, r) => s + (r.resting_hr ?? 0), 0) /
              rhrRows.length
          ),
    days_observed: rows.length,
  };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function bucketByWeek<T extends { date: string }>(
  rows: T[],
  value: (row: T) => number
): number[] {
  const weeks: Record<string, number> = {};
  for (const r of rows) {
    const key = weekKey(r.date);
    weeks[key] = (weeks[key] ?? 0) + value(r);
  }
  return Object.values(weeks);
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
