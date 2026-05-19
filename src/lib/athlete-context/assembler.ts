import { createServerClient } from "@/lib/supabase/server";
import {
  cardioLogsToRunRecords,
  deriveTrainingPaces,
  parseGoalTimeToSec,
  raceTypeToDistanceKm,
} from "@/lib/training/training-paces";
import {
  getActiveBlock,
  getBlockComplianceStats,
  computeBlockWeekNumber,
} from "@/lib/training/blocks";
import type { AthleteContext } from "./types";
import { fetchActiveFacts } from "./facts";
import { orderFactsForPrompt } from "./lifecycle";

/**
 * Single read API for everything the coach needs to ground its next reply.
 * Replaces the ad-hoc parallel fetches that used to live inline in the chat
 * route. All callers that need "what does the coach know about this user
 * right now" should go through here.
 *
 * Order of operations:
 *   1. Parallel pull profile/goals/plan/recovery/hr/availability/cardio/facts
 *   2. Sequential plan-dependent pulls (today/upcoming sessions, week stats, block)
 *   3. Shape into AthleteContext
 */
export async function buildAthleteContext(userId: string): Promise<AthleteContext> {
  const supabase = createServerClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const paceCutoff = new Date();
  paceCutoff.setDate(paceCutoff.getDate() - 90);
  const paceCutoffStr = paceCutoff.toISOString().slice(0, 10);

  const [
    profileRes,
    goalsRes,
    planRes,
    recoveryRes,
    hrZoneRes,
    windowsRes,
    rulesRes,
    paceCardioRes,
    facts,
  ] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("user_goals").select("*").eq("user_id", userId).single(),
    supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single(),
    supabase
      .from("recovery_logs")
      .select("hrv, sleep_hours, resting_hr, body_battery")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .single(),
    supabase
      .from("cardio_logs")
      .select("hr_zones")
      .eq("user_id", userId)
      .eq("is_suppressed", false)
      .not("hr_zones", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("athlete_availability_windows")
      .select("day_of_week, start_time, end_time, max_duration_min, session_count")
      .eq("user_id", userId),
    supabase
      .from("athlete_availability_rules")
      .select("rule_key, params")
      .eq("user_id", userId),
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration")
      .eq("user_id", userId)
      .eq("is_suppressed", false)
      .gte("date", paceCutoffStr)
      .order("date", { ascending: false }),
    fetchActiveFacts(userId),
  ]);

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const plan = planRes.data;
  const recovery = recoveryRes.data;

  // Derive Daniels-style training paces from recent runs, blended toward goal.
  const goalDistanceKm = raceTypeToDistanceKm(goals?.race_type ?? null);
  const goalTimeSec = parseGoalTimeToSec(goals?.goal_time ?? null);
  const trainingPaces = deriveTrainingPaces(
    cardioLogsToRunRecords(
      (paceCardioRes.data ?? []) as Array<{ date: string; type: string; distance: number; duration: number }>,
    ),
    goalDistanceKm && goalTimeSec
      ? { distanceKm: goalDistanceKm, goalTimeSec, date: goals?.race_date ?? null }
      : null,
  );

  const availability =
    (windowsRes.data && windowsRes.data.length > 0) || (rulesRes.data && rulesRes.data.length > 0)
      ? {
          windows: (windowsRes.data ?? []).map((w) => ({
            day_of_week: w.day_of_week as number,
            start_time: w.start_time as string,
            end_time: w.end_time as string,
            max_duration_min: (w.max_duration_min as number | null) ?? null,
            session_count: (w.session_count as number | null) ?? 1,
          })),
          rules: (rulesRes.data ?? []).map((r) => ({
            rule_key: r.rule_key as string,
            params: (r.params as Record<string, unknown> | null) ?? {},
          })),
        }
      : null;

  let hrZones: Array<{ zone: number; low: number; high: number }> | null = null;
  const rawZones = hrZoneRes.data?.hr_zones;
  if (Array.isArray(rawZones) && rawZones.length === 5) {
    const parsed: Array<{ zone: number; low: number; high: number }> = [];
    for (const z of rawZones as Array<{ zone?: number; low?: number; high?: number }>) {
      if (typeof z?.zone === "number" && typeof z?.low === "number" && typeof z?.high === "number") {
        parsed.push({ zone: z.zone, low: z.low, high: z.high });
      }
    }
    if (parsed.length === 5) {
      parsed.sort((a, b) => a.zone - b.zone);
      hrZones = parsed;
    }
  }

  let todaySession: string | null = null;
  let upcomingPlannedSessions: Array<{ date: string; session_type: string; status: string }> = [];
  let weekStats: AthleteContext["weekStats"] = null;
  let blockContext: AthleteContext["block"] = null;

  if (plan) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const [{ data: todayWorkout }, { data: upcoming }] = await Promise.all([
      supabase
        .from("planned_workouts")
        .select("session_type")
        .eq("plan_id", plan.id)
        .eq("date", todayStr)
        .single(),
      supabase
        .from("planned_workouts")
        .select("date, session_type, status")
        .eq("plan_id", plan.id)
        .gte("date", todayStr)
        .lte("date", horizonStr)
        .order("date"),
    ]);

    todaySession = (todayWorkout?.session_type as string | undefined) ?? null;
    upcomingPlannedSessions = (upcoming ?? []).map((w) => ({
      date: w.date as string,
      session_type: (w.session_type as string) ?? "",
      status: (w.status as string) ?? "scheduled",
    }));

    // Week stats: Mon → today
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().slice(0, 10);

    const { data: weekWorkouts } = await supabase
      .from("planned_workouts")
      .select("date, session_type, status, skip_reason")
      .eq("plan_id", plan.id)
      .gte("date", mondayStr)
      .lte("date", todayStr);

    if (weekWorkouts) {
      const nonRest = weekWorkouts.filter((w) => w.session_type !== "Rest");
      const skippedThisWeek = nonRest
        .filter((w) => w.status === "skipped")
        .map((w) => ({
          date: w.date as string,
          sessionType: w.session_type as string,
          reason: (w.skip_reason as string | null) ?? null,
        }));
      weekStats = {
        sessionsPlanned: nonRest.length,
        sessionsCompleted: nonRest.filter((w) => w.status === "completed").length,
        skippedThisWeek: skippedThisWeek.length > 0 ? skippedThisWeek : undefined,
      };
    }

    const activeBlock = await getActiveBlock(plan.id);
    if (activeBlock) {
      const compliance = await getBlockComplianceStats(activeBlock.id);
      const endDate = new Date(activeBlock.end_date);
      const daysUntilEnd = Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      blockContext = {
        block_id: activeBlock.id,
        block_type: activeBlock.block_type,
        block_label: activeBlock.block_label,
        block_number: activeBlock.block_number,
        week_count: activeBlock.week_count,
        current_week: computeBlockWeekNumber(activeBlock.start_date, todayStr),
        end_date: activeBlock.end_date,
        days_until_end: Math.max(0, daysUntilEnd),
        compliance_pct: compliance.pct,
      };
    }
  }

  return {
    profile: profile
      ? {
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
          sex: profile.sex,
          training_experience: profile.training_experience,
        }
      : { age: null, height: null, weight: null, sex: null, training_experience: null },
    goals: goals
      ? {
          body_goal: goals.body_goal,
          emphasis: goals.emphasis,
          days_per_week: goals.days_per_week,
          training_for_race: goals.training_for_race,
          race_type: goals.race_type,
          race_date: goals.race_date,
          goal_time: goals.goal_time,
        }
      : {
          body_goal: "general",
          emphasis: null,
          days_per_week: 4,
          training_for_race: false,
          race_type: null,
          race_date: null,
          goal_time: null,
        },
    plan: plan
      ? {
          id: plan.id,
          split_type: plan.split_type,
          plan_config: (plan.plan_config as Record<string, unknown>) ?? null,
        }
      : null,
    todaySession,
    recovery,
    hrZones,
    trainingPaces,
    weekStats,
    block: blockContext,
    availability,
    upcomingPlannedSessions,
    facts: orderFactsForPrompt(facts),
  };
}
