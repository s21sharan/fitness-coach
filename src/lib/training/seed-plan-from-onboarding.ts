import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  AthleteContextProfile,
  PlanPreviewDay,
  PlanPreviewWeek,
  PlanPreviewWeekBlock,
} from "@/lib/onboarding/types";
import {
  addCalendarDaysYmd,
  dayLabelToMon0Index,
  isValidYmd,
  snapYmdToWeekMonday,
  weekAnchorMondayYmdFromLocalDate,
} from "@/lib/dates/local-calendar";
import { combineSessionContracts } from "@/lib/training/generate-plan";
import type { PlannedWorkoutTargets } from "@/lib/training/workout-contract";

type SplitType = Database["public"]["Tables"]["training_plans"]["Insert"]["split_type"];

function splitTypeForProfile(profile: AthleteContextProfile): SplitType {
  const raw = profile.sports.lift.sport_specific?.split_type;
  const map: Partial<Record<NonNullable<typeof raw>, SplitType>> = {
    full_body: "full_body",
    upper_lower: "upper_lower",
    ppl: "ppl",
    body_part: "bro_split",
    hybrid_custom: "hybrid_upper_lower",
    recommend: "hybrid_upper_lower",
  };
  if (raw && raw in map) return map[raw]!;
  if (profile.sports.run.is_planned || profile.sports.bike.is_planned || profile.sports.swim.is_planned) {
    return "hybrid_upper_lower";
  }
  return "ppl";
}

/** Accepts current `plan_preview` (structured contracts). Legacy text-only drafts return null. */
export function normalizePlanPreviewWeeks(preview: PlanPreviewWeek | null | undefined): PlanPreviewWeekBlock[] | null {
  if (!preview || typeof preview !== "object") return null;
  const p = preview as unknown as Record<string, unknown>;
  if (Array.isArray(p.weeks) && (p.weeks as PlanPreviewWeekBlock[]).length > 0) {
    return p.weeks as PlanPreviewWeekBlock[];
  }
  return null;
}

export function combineDaySessions(day: PlanPreviewDay): { session_type: string; ai_notes: string | null; targets: PlannedWorkoutTargets | null } {
  return combineSessionContracts({
    am: day.am_session,
    pm: day.pm_session,
    is_rest: day.is_rest,
    notes: day.notes,
  });
}

/**
 * Creates or reuses an active `training_plans` row and inserts `planned_workouts`
 * from the onboarding plan preview (anchored to the current week's Monday).
 * Pass `weekAnchorYmd` from the browser (`YYYY-MM-DD` for local Monday) so rows match the user's calendar.
 */
export async function seedPlannedWorkoutsFromOnboardingPreview(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: AthleteContextProfile,
  opts?: { weekAnchorYmd?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const blocks = normalizePlanPreviewWeeks(profile.plan_preview ?? null);
  if (!blocks || blocks.length === 0) return { ok: true };

  const numWeeks = blocks.length;
  const rawAnchor = opts?.weekAnchorYmd;
  const anchorMondayYmd = snapYmdToWeekMonday(
    rawAnchor && isValidYmd(rawAnchor) ? rawAnchor : weekAnchorMondayYmdFromLocalDate(new Date())
  );
  const rangeStartStr = anchorMondayYmd;
  const rangeEndStr = addCalendarDaysYmd(anchorMondayYmd, numWeeks * 7 - 1);

  const { data: existingPlanRows, error: planSelectError } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (planSelectError) {
    console.error("seedPlannedWorkouts: plan select", planSelectError);
    return { ok: false, error: planSelectError.message };
  }

  let planId = existingPlanRows?.[0]?.id;

  const race = profile.events.find((e) => e.priority === "A") ?? profile.events[0];
  let raceType: Database["public"]["Tables"]["training_plans"]["Insert"]["race_type"] = null;
  if (race?.sport_type === "triathlon") {
    const d = (race.distance ?? "").toLowerCase();
    if (d.includes("70.3") || d.includes("half")) raceType = "half_ironman";
    else if (d.includes("140") || d.includes("iron")) raceType = "ironman";
    else if (d.includes("olympic")) raceType = "olympic_tri";
    else if (d.includes("sprint")) raceType = "sprint_tri";
    else raceType = "other";
  } else if (race?.sport_type === "running") {
    const d = (race.distance ?? "").toLowerCase();
    if (d.includes("marathon")) raceType = "marathon";
    else if (d.includes("half")) raceType = "half_marathon";
    else if (d.includes("50") || d.includes("ultra")) raceType = "ultra";
    else if (d.includes("10")) raceType = "10k";
    else raceType = "5k";
  }

  if (!planId) {
    const { data: inserted, error: planInsertError } = await supabase
      .from("training_plans")
      .insert({
        user_id: userId,
        split_type: splitTypeForProfile(profile),
        body_goal: profile.body_nutrition.body_goal,
        race_type: raceType,
        status: "active",
        plan_config: {
          source: "onboarding",
          narrative: profile.plan_preview?.narrative ?? null,
          risks: profile.plan_preview?.risks ?? [],
        } as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (planInsertError || !inserted) {
      console.error("seedPlannedWorkouts: plan insert", planInsertError);
      return { ok: false, error: planInsertError?.message ?? "plan insert failed" };
    }
    planId = inserted.id;
  }

  const { error: delError } = await supabase
    .from("planned_workouts")
    .delete()
    .eq("plan_id", planId)
    .gte("date", rangeStartStr)
    .lte("date", rangeEndStr);

  if (delError) {
    console.error("seedPlannedWorkouts: delete range", delError);
    return { ok: false, error: delError.message };
  }

  const rows: Database["public"]["Tables"]["planned_workouts"]["Insert"][] = [];

  for (const block of blocks) {
    const weekOffset = block.week_number - 1;
    const weekBaseYmd = addCalendarDaysYmd(anchorMondayYmd, weekOffset * 7);

    for (const day of block.days) {
      const idx = dayLabelToMon0Index(day.day_label);
      if (idx < 0) continue;
      const ymd = addCalendarDaysYmd(weekBaseYmd, idx);
      const { session_type, ai_notes, targets } = combineDaySessions(day);

      rows.push({
        plan_id: planId,
        date: ymd,
        day_of_week: idx,
        session_type,
        ai_notes,
        status: "scheduled",
        approved: false,
        targets: targets as Record<string, unknown> | null,
      });
    }
  }

  if (rows.length === 0) return { ok: true };

  const { error: insError } = await supabase.from("planned_workouts").insert(rows);
  if (insError) {
    console.error("seedPlannedWorkouts: insert", insError);
    return { ok: false, error: insError.message };
  }

  return { ok: true };
}
