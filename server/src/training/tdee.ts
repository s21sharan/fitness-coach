import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";

const KCAL_PER_LB = 3500;
const EWMA_ALPHA = 0.1;
const FIT_WINDOW_DAYS = 14;
const K_MIN = 0.7;
const K_MAX = 1.3;
const DEFAULT_ACTIVITY_FACTOR = 1.5;

/**
 * Exponentially-weighted moving trend weight (MF-style).
 * Returns null if there are no weigh-ins on or before `asOf`.
 */
export async function computeTrendWeight(userId: string, asOf: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("weigh_ins")
    .select("date, weight_lbs")
    .eq("user_id", userId)
    .lte("date", asOf)
    .order("date", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  let trend = Number(data[0].weight_lbs);
  for (let i = 1; i < data.length; i++) {
    const w = Number(data[i].weight_lbs);
    trend = EWMA_ALPHA * w + (1 - EWMA_ALPHA) * trend;
  }
  return trend;
}

function mifflinStJeor(
  sex: string | null,
  weightLbs: number | null,
  heightCm: number | null,
  age: number | null,
): number | null {
  if (!weightLbs || !heightCm || !age) return null;
  const weightKg = weightLbs * 0.453592;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "M") return base + 5;
  if (sex === "F") return base - 161;
  return base - 78;
}

/**
 * Fit a multiplicative correction factor k against the last FIT_WINDOW_DAYS:
 *   ΔtrendWeight * 3500 ≈ Σintake − k * Σwearable_burn
 * Solve for k, clamp to [K_MIN, K_MAX]. Returns 1 if not enough data.
 */
export async function fitCorrectionFactor(userId: string): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - FIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [intakeRes, expRes] = await Promise.all([
    supabase
      .from("food_log_entries")
      .select("logged_at, calories")
      .eq("user_id", userId)
      .gte("logged_at", `${startStr}T00:00:00Z`)
      .lte("logged_at", `${endStr}T23:59:59Z`),
    supabase
      .from("expenditure_daily")
      .select("date, wearable_kcal, estimated_kcal")
      .eq("user_id", userId)
      .gte("date", startStr)
      .lte("date", endStr),
  ]);

  const intakeByDate = new Map<string, number>();
  for (const row of intakeRes.data || []) {
    const d = (row.logged_at as string).slice(0, 10);
    intakeByDate.set(d, (intakeByDate.get(d) || 0) + (Number(row.calories) || 0));
  }

  let sumIntake = 0;
  let sumBurn = 0;
  let pairedDays = 0;
  for (const row of expRes.data || []) {
    const intake = intakeByDate.get(row.date as string);
    const burn = (row.wearable_kcal ?? row.estimated_kcal) as number | null;
    if (intake == null || burn == null) continue;
    sumIntake += intake;
    sumBurn += Number(burn);
    pairedDays += 1;
  }

  const startTrend = await computeTrendWeight(userId, startStr);
  const endTrend = await computeTrendWeight(userId, endStr);

  let k = 1;
  let weightDelta: number | null = null;
  if (pairedDays >= 7 && sumBurn > 0 && startTrend != null && endTrend != null) {
    weightDelta = endTrend - startTrend;
    const rawK = (sumIntake - weightDelta * KCAL_PER_LB) / sumBurn;
    k = Math.max(K_MIN, Math.min(K_MAX, rawK));
  }

  await supabase.from("tdee_corrections").insert({
    user_id: userId,
    window_start: startStr,
    window_end: endStr,
    mean_intake: pairedDays > 0 ? sumIntake / pairedDays : null,
    mean_expenditure_raw: pairedDays > 0 ? sumBurn / pairedDays : null,
    weight_delta_lbs: weightDelta,
    fitted_k: k,
    notes: pairedDays < 7 ? `insufficient data (${pairedDays} paired days)` : null,
  });

  await supabase
    .from("expenditure_daily")
    .update({ correction_k: k, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .gte("date", startStr);

  return k;
}

/**
 * Returns the user's TDEE for a given date.
 * Prefers wearable_kcal * k; falls back to BMR (Mifflin-St Jeor) * activity_factor * k.
 */
export async function getTdee(userId: string, date: string): Promise<number | null> {
  const { data: exp } = await supabase
    .from("expenditure_daily")
    .select("wearable_kcal, estimated_kcal, correction_k")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const k = Number(exp?.correction_k ?? 1);

  if (exp?.wearable_kcal != null) {
    return Number(exp.wearable_kcal) * k;
  }
  if (exp?.estimated_kcal != null) {
    return Number(exp.estimated_kcal) * k;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("weight, height, age, sex, activity_level")
    .eq("user_id", userId)
    .single();

  const bmr = mifflinStJeor(
    profile?.sex ?? null,
    profile?.weight ?? null,
    profile?.height ?? null,
    profile?.age ?? null,
  );
  if (bmr == null) return null;

  const af = Number(profile?.activity_level ?? DEFAULT_ACTIVITY_FACTOR);
  const estimated = bmr * af;

  await supabase.from("expenditure_daily").upsert(
    {
      user_id: userId,
      date,
      bmr_kcal: bmr,
      estimated_kcal: estimated,
      tdee_kcal: estimated * k,
      correction_k: k,
      source: "estimated" as const,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );

  return estimated * k;
}

/**
 * Fits correction factor for every user with an active food log.
 * Runs nightly via cron.
 */
export async function fitAllUsers(): Promise<void> {
  const { data: users } = await supabase
    .from("food_log_entries")
    .select("user_id")
    .gte("logged_at", new Date(Date.now() - FIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString());

  const unique = Array.from(new Set((users || []).map((r) => r.user_id as string)));
  for (const userId of unique) {
    try {
      await fitCorrectionFactor(userId);
    } catch (err) {
      logger.error("TDEE fit failed", { userId, error: String(err) });
    }
  }
}
