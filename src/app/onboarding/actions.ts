"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { aggregateAthleteLoad } from "@/lib/training-load/aggregate";
import { computeAllScores } from "@/lib/onboarding/scoring";
import type {
  Aggressiveness,
  AthleteContextProfile,
  AthleteIdentity,
  BodyGoalDetailed,
  ChatInsertionPoint,
  DietStyle,
  Experience,
  ExplanationLevel,
  ExtractedChatTags,
  GoalKey,
  MissedWorkoutBehavior,
  PlanFlexibility,
  PrimaryGoal,
  ProteinTier,
  Sex,
  SportEntry,
  SportId,
  StepId,
} from "@/lib/onboarding/types";
import { getDefaultAthleteProfile, proteinGramsFromTier } from "@/lib/onboarding/types";
import { isValidIanaTimeZone } from "@/lib/dates/local-calendar";
import { seedPlannedWorkoutsFromOnboardingPreview } from "@/lib/training/seed-plan-from-onboarding";
import { gatherSpecAuthorContext } from "@/lib/training/spec/context";
import { authorSpecPayload } from "@/lib/training/spec/author";
import { mutateSpec } from "@/lib/training/spec/store";

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
// Reconstruct profile from committed athlete_* tables
//
// Drafts are deleted on commit (see end of commitOnboardingData),
// so re-entering onboarding from settings has nothing to hydrate
// from. This rebuilds an AthleteContextProfile by reading every
// table the commit step wrote to.
// ============================================================

export async function loadCommittedProfile(): Promise<DraftResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated", profile: null, step: null };

  const supabase = createServerClient();

  const [
    profileRow,
    goalsRow,
    sportsRows,
    eventsRows,
    availWindowsRows,
    availRulesRows,
    recoveryRow,
    injuriesRows,
    equipmentRows,
    bodyNutritionRow,
    preferencesRow,
    coachRow,
    chatNotesRows,
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_goals").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_sports").select("*").eq("user_id", userId),
    supabase.from("athlete_events").select("*").eq("user_id", userId),
    supabase.from("athlete_availability_windows").select("*").eq("user_id", userId),
    supabase.from("athlete_availability_rules").select("*").eq("user_id", userId),
    supabase.from("athlete_recovery").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_injuries").select("*").eq("user_id", userId),
    supabase.from("athlete_equipment").select("*").eq("user_id", userId),
    supabase.from("athlete_body_nutrition").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_coach_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("athlete_chat_notes").select("*").eq("user_id", userId),
  ]);

  const hasCommittedData =
    !!profileRow.data ||
    !!goalsRow.data ||
    (sportsRows.data?.length ?? 0) > 0 ||
    !!bodyNutritionRow.data ||
    !!recoveryRow.data;

  if (!hasCommittedData) {
    return { success: true, profile: null, step: null };
  }

  const defaults = getDefaultAthleteProfile();
  const profile = defaults; // start from defaults so any missing tables fall through cleanly

  // 1. basic + identity
  if (profileRow.data) {
    profile.basic = {
      height_cm: profileRow.data.height ?? null,
      weight_lbs: profileRow.data.weight ?? null,
      age: profileRow.data.age ?? null,
      sex: (profileRow.data.sex as Sex | null) ?? null,
      training_experience: (profileRow.data.training_experience as Experience | null) ?? null,
    };
    profile.athlete_identity = (profileRow.data.athlete_identity as AthleteIdentity | null) ?? null;
  }

  // 2. goals — only the fields the UI re-uses (legacy body_goal lives in athlete_body_nutrition)
  if (goalsRow.data) {
    profile.goal_keys = (goalsRow.data.secondary_goals as GoalKey[] | null) ?? [];
    profile.goal_rank = (goalsRow.data.goal_rank as GoalKey[] | null) ?? [];
    profile.primary_optimization = (goalsRow.data.primary_goal as PrimaryGoal | null) ?? null;
    profile.aggressiveness = (goalsRow.data.aggressiveness as Aggressiveness | null) ?? null;
  }

  // 3. sports — fill defaults, overwrite from committed rows
  for (const row of sportsRows.data ?? []) {
    const sport = row.sport as SportId;
    profile.sports[sport] = {
      sport,
      enabled: row.enabled,
      is_planned: row.is_planned,
      priority: row.priority,
      is_primary: row.is_primary,
      is_limiter: row.is_limiter,
      current_volume: (row.current_volume as SportEntry["current_volume"]) ?? null,
      target_peak: (row.target_peak as SportEntry["target_peak"]) ?? null,
      sport_specific: (row.sport_specific as SportEntry["sport_specific"]) ?? null,
    };
  }

  // 4. events
  profile.events = (eventsRows.data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    sport_type: e.sport_type,
    distance: e.distance,
    event_date: e.event_date,
    priority: e.priority,
    goal_type: e.goal_type,
    goal_time: e.goal_time,
    course_notes: e.course_notes,
    travel: e.travel,
  }));
  profile.no_event = profile.events.length === 0 && !!goalsRow.data && !goalsRow.data.training_for_race;

  // 5. availability windows + rules (normalize Postgres TIME "HH:MM:SS" → "HH:MM")
  profile.availability_windows = (availWindowsRows.data ?? []).map((w) => ({
    id: w.id,
    day_of_week: w.day_of_week,
    start_time: normalizeTime(w.start_time),
    end_time: normalizeTime(w.end_time),
    max_duration_min: w.max_duration_min,
    session_count: w.session_count ?? 1,
    locations: w.locations ?? [],
  }));
  profile.availability_rules = (availRulesRows.data ?? []).map((r) => ({
    id: r.id,
    rule_key: r.rule_key,
    params: r.params,
  }));

  // 6. recovery
  if (recoveryRow.data) {
    profile.recovery = {
      avg_sleep_hours: recoveryRow.data.avg_sleep_hours ?? null,
      sleep_consistency: (recoveryRow.data.sleep_consistency as
        | "very_consistent"
        | "mostly_consistent"
        | "variable"
        | "poor"
        | null) ?? null,
      work_stress: (recoveryRow.data.work_stress as "low" | "moderate" | "high" | "very_high" | null) ?? null,
      physical_job: recoveryRow.data.physical_job ?? false,
      has_readiness_data: recoveryRow.data.has_readiness_data ?? false,
      sore_frequency: (recoveryRow.data.sore_frequency as "rarely" | "sometimes" | "often" | "always" | null) ?? null,
      recovery_confidence: (recoveryRow.data.recovery_confidence as
        | "always_cooked"
        | "slightly_under"
        | "usually_ok"
        | "fresh"
        | "under_training"
        | null) ?? null,
    };
  }

  // 7. injuries
  profile.injuries = (injuriesRows.data ?? []).map((i) => ({
    id: i.id,
    area: i.area,
    description: i.description ?? null,
    current_pain_level: i.current_pain_level ?? 0,
    history: i.history ?? false,
    triggers: i.triggers ?? [],
    affecting_training: i.affecting_training ?? false,
  }));

  // 8. equipment
  profile.equipment = (equipmentRows.data ?? []).map((e) => ({
    id: e.id,
    sport: e.sport as SportId,
    item: e.item,
    available: e.available ?? false,
    notes: e.notes ?? undefined,
  }));

  // 9. body & nutrition
  if (bodyNutritionRow.data) {
    profile.body_nutrition = {
      body_goal: (bodyNutritionRow.data.body_goal as BodyGoalDetailed | null) ?? null,
      goal_weight_lbs: bodyNutritionRow.data.goal_weight_lbs ?? null,
      target_rate_lbs_per_week: bodyNutritionRow.data.target_rate_lbs_per_week ?? null,
      diet_style: (bodyNutritionRow.data.diet_style as DietStyle | string | null) ?? null,
      protein_tier: (bodyNutritionRow.data.protein_tier as ProteinTier | null) ?? null,
      protein_target_g: bodyNutritionRow.data.protein_target_g ?? null,
      fuel_workouts_when_cutting: (bodyNutritionRow.data.fuel_workouts_when_cutting as
        | "yes"
        | "sometimes"
        | "avoid_around_workouts"
        | "not_sure"
        | null) ?? null,
      tracking_app: (bodyNutritionRow.data.tracking_app as
        | "macrofactor"
        | "myfitnesspal"
        | "cronometer"
        | "none"
        | "other"
        | null) ?? null,
      notes: bodyNutritionRow.data.notes ?? "",
    };
  }

  // 10. preferences
  if (preferencesRow.data) {
    profile.preferences = {
      motivation_drivers: preferencesRow.data.motivation_drivers ?? [],
      common_derailers: preferencesRow.data.common_derailers ?? [],
      enjoyed_workouts: preferencesRow.data.enjoyed_workouts ?? [],
      dislikes: preferencesRow.data.dislikes ?? [],
      sacrifice_priority: preferencesRow.data.sacrifice_priority ?? [],
      protect_priority: preferencesRow.data.protect_priority ?? [],
    };
  }

  // 11. coach
  if (coachRow.data) {
    profile.coach = {
      aggressiveness: (coachRow.data.aggressiveness as Aggressiveness | null) ?? null,
      explanation_level: (coachRow.data.explanation_level as ExplanationLevel | null) ?? null,
      missed_workout_behavior: (coachRow.data.missed_workout_behavior as MissedWorkoutBehavior | null) ?? null,
      plan_flexibility: (coachRow.data.plan_flexibility as PlanFlexibility | null) ?? null,
      tone_notes: coachRow.data.tone_notes ?? "",
    };
  }

  // 12. chat notes
  profile.chat_notes = (chatNotesRows.data ?? []).map((n) => ({
    insertion_point: n.insertion_point as ChatInsertionPoint,
    raw_text: n.raw_text,
    extracted: (n.extracted as ExtractedChatTags | null) ?? null,
  }));

  // Give every reconstructed entity a stable client id where the schema didn't provide one
  // (events/injuries/equipment use DB ids above; chat_notes don't need ids).

  return { success: true, profile, step: null };
}

function normalizeTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
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
// Core persistence helper — writes to all normalized athlete
// tables but does NOT flip onboarding_completed or delete draft.
// ============================================================

async function persistProfileTables(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
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

  // 12c. author the athlete's coaching constraint spec in the background from
  // the freshly committed profile/goals/facts. Fire-and-forget so onboarding
  // stays snappy; if it doesn't finish, ensureActiveSpec backfills it lazily on
  // first plan generation. A failure here must never block onboarding.
  void authorOnboardingSpec(userId);

  return { success: true };
}

// ============================================================
// Final commit — persists profile tables + flips onboarding_completed
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

  const persistResult = await persistProfileTables(supabase, userId, profile, calendarOpts);
  if (!persistResult.success) return persistResult;

  // flip onboarding_completed + delete draft
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
// Persist profile without completing onboarding — used before
// redirecting to Stripe so data isn't lost if the user navigates
// away during checkout.
// ============================================================

export async function commitProfileWithoutCompletion(
  profile: AthleteContextProfile,
  calendarOpts?: { calendarWeekAnchorYmd?: string; calendarTimezone?: string }
): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();
  const userErr = await ensureUsersRow(supabase, userId);
  if (userErr) return userErr;

  return persistProfileTables(supabase, userId, profile, calendarOpts);
}

// ============================================================
// Helpers
// ============================================================

function failWith(table: string, msg: string): ActionResult {
  console.error(`commitOnboardingData(${table}) failed:`, msg);
  return { success: false, error: `Failed to save ${table}: ${msg}` };
}

/** Author the initial constraint spec from onboarding data. Best-effort. */
async function authorOnboardingSpec(userId: string): Promise<void> {
  try {
    const ctx = await gatherSpecAuthorContext(userId);
    const proposed = await authorSpecPayload(ctx);
    const result = await mutateSpec({
      userId,
      ctx,
      proposed,
      source: "onboarding",
      justification: "Initial spec authored from onboarding profile, goals, and stated preferences/injuries.",
    });
    if (!result.ok) console.error("onboarding spec authoring rejected:", result);
  } catch (e) {
    console.error("onboarding spec authoring failed (will backfill lazily):", e);
  }
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
