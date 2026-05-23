import { createServerClient } from "@/lib/supabase/server";
import { getRecentActivityStats } from "@/lib/training/generate-plan";
import { fetchActiveFacts } from "@/lib/athlete-context/facts";
import { formatFactsForPlanPrompt } from "@/lib/athlete-context/format";
import type { RecentActivity } from "@/lib/training/prompts";

/**
 * Everything the spec author needs to derive per-athlete constraints. Shared by
 * onboarding seeding and lazy backfill so both author from the same inputs.
 */
export interface SpecAuthorContext {
  profile: {
    age: number | null;
    sex: string | null;
    height: number | null;
    weight: number | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number | null;
    lifting_days: number | null;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    does_cardio: boolean;
    cardio_types: string[] | null;
  };
  factsBlock: string | null;
  recentActivity: RecentActivity | null;
}

/** Read profile, goals, durable facts, and recent activity for spec authoring. */
export async function gatherSpecAuthorContext(userId: string): Promise<SpecAuthorContext> {
  const supabase = createServerClient();

  const [{ data: profile }, { data: goals }, facts, recentActivity] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
    supabase.from("user_goals").select("*").eq("user_id", userId).single(),
    fetchActiveFacts(userId),
    getRecentActivityStats(userId),
  ]);

  return {
    profile: {
      age: profile?.age ?? null,
      sex: profile?.sex ?? null,
      height: profile?.height ?? null,
      weight: profile?.weight ?? null,
      training_experience: profile?.training_experience ?? null,
    },
    goals: {
      body_goal: goals?.body_goal ?? "general_fitness",
      emphasis: goals?.emphasis ?? null,
      days_per_week: goals?.days_per_week ?? null,
      lifting_days: goals?.lifting_days ?? null,
      training_for_race: goals?.training_for_race ?? false,
      race_type: goals?.race_type ?? null,
      race_date: goals?.race_date ?? null,
      does_cardio: goals?.does_cardio ?? false,
      cardio_types: goals?.cardio_types ?? [],
    },
    factsBlock: formatFactsForPlanPrompt(facts),
    recentActivity,
  };
}

/** Render the author context as a compact prompt block. */
export function renderAuthorContext(ctx: SpecAuthorContext): string {
  const lines: string[] = [];
  const p = ctx.profile;
  const g = ctx.goals;
  const prof: string[] = [];
  if (p.age) prof.push(`${p.age}yo`);
  if (p.sex) prof.push(p.sex);
  if (p.training_experience) prof.push(p.training_experience);
  if (prof.length) lines.push(`Profile: ${prof.join(", ")}`);
  lines.push(`Goal: ${g.body_goal}${g.emphasis && g.emphasis !== "none" ? ` (emphasis: ${g.emphasis})` : ""}`);
  if (g.days_per_week) lines.push(`Available training days/week: ${g.days_per_week}`);
  if (g.lifting_days != null) lines.push(`Desired lifting days/week: ${g.lifting_days}`);
  if (g.training_for_race && g.race_type) {
    lines.push(`Training for: ${g.race_type}${g.race_date ? ` on ${g.race_date}` : ""}`);
  }
  if (g.does_cardio && g.cardio_types?.length) lines.push(`Cardio: ${g.cardio_types.join(", ")}`);

  if (ctx.recentActivity) {
    const a = ctx.recentActivity;
    const parts: string[] = [];
    if (a.weeklyRunCount) parts.push(`${a.weeklyRunCount} runs/wk`);
    if (a.avgRunDistanceKm) parts.push(`avg run ${a.avgRunDistanceKm}km`);
    if (a.weeklyLiftCount) parts.push(`${a.weeklyLiftCount} lifts/wk`);
    if (a.avgHrv) parts.push(`HRV ${a.avgHrv}`);
    if (a.avgSleepHours) parts.push(`sleep ${a.avgSleepHours}h`);
    if (parts.length) lines.push(`Recent activity (30d): ${parts.join(", ")}`);
  }

  if (ctx.factsBlock) {
    lines.push("");
    lines.push("What the athlete has told us (injuries, preferences, scheduling constraints):");
    lines.push(ctx.factsBlock);
  }
  return lines.join("\n");
}
