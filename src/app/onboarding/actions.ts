"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { aggregateAthleteLoad } from "@/lib/training-load/aggregate";
import { computeAllScores } from "@/lib/onboarding/scoring";
import type {
  AthleteContextProfile,
  SportEntry,
  StepId,
} from "@/lib/onboarding/types";
import { getDefaultAthleteProfile, proteinGramsFromTier } from "@/lib/onboarding/types";
import { isValidIanaTimeZone } from "@/lib/dates/local-calendar";
import { seedPlannedWorkoutsFromOnboardingPreview } from "@/lib/training/seed-plan-from-onboarding";

interface ActionResult {
  success: boolean;
  error?: string;
}

interface DraftResult extends ActionResult {
  profile: AthleteContextProfile | null;
  step: StepId | null;
}

/**
 * `user_profiles`, `user_goals`, `onboarding_drafts`, etc. FK to `public.users`.
 * That row is normally created by the Clerk `user.created` webhook; if the webhook
 * is missing in local dev or failed once, inserts would violate `user_profiles_user_id_fkey`.
 */
async function ensureUsersRow(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<ActionResult | null> {
  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    `${userId}@placeholder.hybro.local`;

  const { error } = await supabase.from("users").upsert(
    { id: userId, email },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) {
    console.error("ensureUsersRow failed:", error);
    return failWith("users", error.message);
  }
  return null;
}

// ============================================================
// Draft load / save
// ============================================================

export async function getOnboardingDraft(): Promise<DraftResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated", profile: null, step: null };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("onboarding_drafts")
    .select("payload, current_step")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load onboarding draft:", error);
    return { success: false, error: "Failed to load draft", profile: null, step: null };
  }

  if (!data) return { success: true, profile: null, step: null };

  return {
    success: true,
    profile: data.payload as unknown as AthleteContextProfile,
    step: (data.current_step as StepId | null) ?? null,
  };
}

export async function saveOnboardingDraft(
  profile: AthleteContextProfile,
  currentStep: StepId
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  const { error } = await supabase
    .from("onboarding_drafts")
    .upsert(
      {
        user_id: userId,
        payload: profile as unknown as Record<string, unknown>,
        current_step: currentStep,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Failed to save onboarding draft:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================
// Pre-fill aggregator (called by the load_current screen)
// ============================================================

export async function fetchAggregatedLoad() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated", load: null };

  const supabase = createServerClient();
  try {
    const load = await aggregateAthleteLoad(supabase, userId);
    return { success: true, load };
  } catch (err) {
    console.error("Failed to aggregate load:", err);
    return { success: false, error: "Failed to aggregate", load: null };
  }
}

// ============================================================
// Final commit — writes to all normalized tables
// ============================================================

export async function commitOnboardingData(
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  // 1. user_profiles
  {
    const row: Record<string, unknown> = {
      user_id: userId,
      height: profile.basic.height_cm,
      weight: profile.basic.weight_lbs,
      age: profile.basic.age,
      sex: profile.basic.sex,
      training_experience: profile.basic.training_experience,
      athlete_identity: profile.athlete_identity,
    };
    if (calendarOpts?.calendarTimezone && isValidIanaTimeZone(calendarOpts.calendarTimezone)) {
      row.timezone = calendarOpts.calendarTimezone.trim();
    }
    const { error } = await supabase.from("user_profiles").upsert(row as never, { onConflict: "user_id" });
    if (error) return failWith("user_profiles", error.message);
  }

  // 2. user_goals (legacy shape)
  {
    const { error } = await supabase.from("user_goals").upsert(
      {
        user_id: userId,
        body_goal: mapBodyGoal(profile.body_nutrition.body_goal),
        training_for_race: profile.events.length > 0,
        does_cardio: hasAnyCardio(profile),
        cardio_types: cardioTypesFromProfile(profile),
        days_per_week: estimateDaysPerWeek(profile),
        lifting_days: profile.sports.lift.target_peak?.weekly_sessions ?? null,
        primary_goal: profile.primary_optimization,
        secondary_goals: profile.goal_keys,
        goal_rank: profile.goal_rank,
        aggressiveness: profile.aggressiveness,
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("user_goals", error.message);
  }

  // 3. athlete_sports — wipe and replace
  await supabase.from("athlete_sports").delete().eq("user_id", userId);
  const sportRows = (Object.values(profile.sports) as SportEntry[])
    .filter((s) => s.enabled || s.is_planned)
    .map((s) => ({
      user_id: userId,
      sport: s.sport,
      enabled: s.enabled,
      is_planned: s.is_planned,
      priority: s.priority,
      is_primary: s.is_primary,
      is_limiter: s.is_limiter,
      current_volume: (s.current_volume as Record<string, unknown> | null) ?? null,
      target_peak: (s.target_peak as Record<string, unknown> | null) ?? null,
      sport_specific: (s.sport_specific as Record<string, unknown> | null) ?? null,
    }));
  if (sportRows.length > 0) {
    const { error } = await supabase.from("athlete_sports").insert(sportRows);
    if (error) return failWith("athlete_sports", error.message);
  }

  // 4. events
  await supabase.from("athlete_events").delete().eq("user_id", userId);
  if (profile.events.length > 0) {
    const { error } = await supabase.from("athlete_events").insert(
      profile.events.map((e) => ({
        user_id: userId,
        name: e.name,
        sport_type: e.sport_type,
        distance: e.distance,
        event_date: e.event_date,
        priority: e.priority,
        goal_type: e.goal_type,
        goal_time: e.goal_time,
        course_notes: e.course_notes,
        travel: e.travel,
      }))
    );
    if (error) return failWith("athlete_events", error.message);
  }

  // 5. availability windows + rules
  await supabase.from("athlete_availability_windows").delete().eq("user_id", userId);
  if (profile.availability_windows.length > 0) {
    const { error } = await supabase.from("athlete_availability_windows").insert(
      profile.availability_windows.map((w) => ({
        user_id: userId,
        day_of_week: w.day_of_week,
        start_time: w.start_time,
        end_time: w.end_time,
        max_duration_min: w.max_duration_min,
        session_count: w.session_count ?? 1,
        locations: w.locations,
      }))
    );
    if (error) return failWith("athlete_availability_windows", error.message);
  }

  await supabase.from("athlete_availability_rules").delete().eq("user_id", userId);
  if (profile.availability_rules.length > 0) {
    const { error } = await supabase.from("athlete_availability_rules").insert(
      profile.availability_rules.map((r) => ({
        user_id: userId,
        rule_key: r.rule_key,
        params: r.params,
      }))
    );
    if (error) return failWith("athlete_availability_rules", error.message);
  }

  // 6. recovery (one row)
  {
    const { error } = await supabase.from("athlete_recovery").upsert(
      {
        user_id: userId,
        avg_sleep_hours: profile.recovery.avg_sleep_hours,
        sleep_consistency: profile.recovery.sleep_consistency,
        work_stress: profile.recovery.work_stress,
        physical_job: profile.recovery.physical_job,
        has_readiness_data: profile.recovery.has_readiness_data,
        sore_frequency: profile.recovery.sore_frequency,
        recovery_confidence: profile.recovery.recovery_confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("athlete_recovery", error.message);
  }

  // 7. injuries
  await supabase.from("athlete_injuries").delete().eq("user_id", userId);
  if (profile.injuries.length > 0) {
    const { error } = await supabase.from("athlete_injuries").insert(
      profile.injuries.map((i) => ({
        user_id: userId,
        area: i.area,
        description: i.description ?? null,
        current_pain_level: i.current_pain_level,
        history: i.history,
        triggers: i.triggers,
        affecting_training: i.affecting_training,
      }))
    );
    if (error) return failWith("athlete_injuries", error.message);
  }

  // 8. equipment
  await supabase.from("athlete_equipment").delete().eq("user_id", userId);
  if (profile.equipment.length > 0) {
    const { error } = await supabase.from("athlete_equipment").insert(
      profile.equipment.map((e) => ({
        user_id: userId,
        sport: e.sport,
        item: e.item,
        available: e.available,
        notes: e.notes ?? null,
      }))
    );
    if (error) return failWith("athlete_equipment", error.message);
  }

  // 9. body & nutrition
  {
    const bn = profile.body_nutrition;
    const proteinFromTier = proteinGramsFromTier(bn.protein_tier, profile.basic.weight_lbs);
    const { error } = await supabase.from("athlete_body_nutrition").upsert(
      {
        user_id: userId,
        body_goal: bn.body_goal,
        goal_weight_lbs: bn.goal_weight_lbs,
        target_rate_lbs_per_week: bn.target_rate_lbs_per_week,
        diet_style: bn.diet_style,
        protein_target_g: proteinFromTier ?? bn.protein_target_g,
        protein_tier: bn.protein_tier,
        fuel_workouts_when_cutting: bn.fuel_workouts_when_cutting,
        tracking_app: bn.tracking_app,
        notes: bn.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("athlete_body_nutrition", error.message);
  }

  // 10. preferences
  {
    const { error } = await supabase.from("athlete_preferences").upsert(
      {
        user_id: userId,
        motivation_drivers: profile.preferences.motivation_drivers,
        common_derailers: profile.preferences.common_derailers,
        enjoyed_workouts: profile.preferences.enjoyed_workouts,
        dislikes: profile.preferences.dislikes,
        sacrifice_priority: profile.preferences.sacrifice_priority,
        protect_priority: profile.preferences.protect_priority,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("athlete_preferences", error.message);
  }

  // 11. coach settings
  {
    const { error } = await supabase.from("athlete_coach_settings").upsert(
      {
        user_id: userId,
        aggressiveness: profile.coach.aggressiveness,
        explanation_level: profile.coach.explanation_level,
        missed_workout_behavior: profile.coach.missed_workout_behavior,
        plan_flexibility: profile.coach.plan_flexibility,
        tone_notes: profile.coach.tone_notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("athlete_coach_settings", error.message);
  }

  // 12. derived scores
  {
    const scores = computeAllScores(profile);
    const { error } = await supabase.from("athlete_derived_scores").upsert(
      {
        user_id: userId,
        ...scores,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return failWith("athlete_derived_scores", error.message);
  }

  // 12b. training plan + planned workouts from plan preview (workout contracts for calendar / Garmin path)
  {
    const seed = await seedPlannedWorkoutsFromOnboardingPreview(supabase, userId, profile, {
      weekAnchorYmd: calendarOpts?.calendarWeekAnchorYmd,
    });
    if (!seed.ok) return failWith("planned_workouts", seed.error);
  }

  // 13. flip onboarding_completed + delete draft
  {
    const { error } = await supabase
      .from("users")
      .update({ onboarding_completed: true })
      .eq("id", userId);
    if (error) return failWith("users", error.message);
  }
  await supabase.from("onboarding_drafts").delete().eq("user_id", userId);

  return { success: true };
}

// ============================================================
// Helpers
// ============================================================

function failWith(table: string, msg: string): ActionResult {
  console.error(`commitOnboardingData(${table}) failed:`, msg);
  return { success: false, error: `Failed to save ${table}: ${msg}` };
}

function mapBodyGoal(
  body: AthleteContextProfile["body_nutrition"]["body_goal"]
): "gain_muscle" | "lose_weight" | "maintain" | "other" {
  if (!body) return "maintain";
  if (body === "lean_bulk" || body === "aggressive_bulk" || body === "strength_focused") return "gain_muscle";
  if (body === "cut_fat" || body === "slow_cut" || body === "race_weight_focused") return "lose_weight";
  if (body === "maintain" || body === "recomp") return "maintain";
  return "other";
}

function hasAnyCardio(p: AthleteContextProfile): boolean {
  return p.sports.run.is_planned || p.sports.bike.is_planned || p.sports.swim.is_planned;
}

function cardioTypesFromProfile(p: AthleteContextProfile): string[] | null {
  const types: string[] = [];
  if (p.sports.run.is_planned) types.push("running");
  if (p.sports.bike.is_planned) types.push("cycling");
  if (p.sports.swim.is_planned) types.push("swimming");
  return types.length > 0 ? types : null;
}

function estimateDaysPerWeek(p: AthleteContextProfile): number {
  if (p.availability_windows.length > 0) {
    const uniqueDays = new Set(p.availability_windows.map((w) => w.day_of_week));
    return Math.max(3, Math.min(7, uniqueDays.size));
  }
  let total = 0;
  for (const s of Object.values(p.sports)) {
    total += s.target_peak?.weekly_sessions ?? 0;
  }
  return Math.max(3, Math.min(7, total || 4));
}

// Re-export for client use convenience
export async function newDefaultProfile() {
  return getDefaultAthleteProfile();
}
