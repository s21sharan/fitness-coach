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
import {
  buildWorkoutContractFromSessionText,
  inferWorkoutSport,
  type PlannedWorkoutTargets,
} from "@/lib/training/workout-contract";

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

/** Accepts current `plan_preview` or legacy drafts with `first_week` only. */
export function normalizePlanPreviewWeeks(preview: PlanPreviewWeek | null | undefined): PlanPreviewWeekBlock[] | null {
  if (!preview || typeof preview !== "object") return null;
  const p = preview as Record<string, unknown>;
  if (Array.isArray(p.weeks) && (p.weeks as PlanPreviewWeekBlock[]).length > 0) {
    return p.weeks as PlanPreviewWeekBlock[];
  }
  const fw = p.first_week as Array<{ day_label: string; session: string; rationale: string }> | undefined;
  if (Array.isArray(fw) && fw.length === 7) {
    const days: PlanPreviewDay[] = fw.map((row) => ({
      day_label: row.day_label,
      am_session: row.session && !/^rest$/i.test(row.session) ? row.session : null,
      am_rationale: row.rationale ?? null,
      pm_session: null,
      pm_rationale: null,
      is_rest: /^rest$/i.test(row.session || ""),
      notes: null,
    }));
    return [{ week_number: 1, week_focus: String(p.narrative ?? "Week 1"), days }];
  }
  return null;
}

export function combineDaySessions(day: PlanPreviewDay): { session_type: string; ai_notes: string | null; targets: PlannedWorkoutTargets | null } {
  if (day.is_rest) {
    return { session_type: "Rest", ai_notes: day.notes, targets: null };
  }
  const parts: string[] = [];
  const notes: string[] = [];
  if (day.am_session?.trim()) {
    parts.push(`AM: ${day.am_session.trim()}`);
    if (day.am_rationale?.trim()) notes.push(`AM — ${day.am_rationale.trim()}`);
  }
  if (day.pm_session?.trim()) {
    parts.push(`PM: ${day.pm_session.trim()}`);
    if (day.pm_rationale?.trim()) notes.push(`PM — ${day.pm_rationale.trim()}`);
  }
  const session_type = parts.length > 0 ? parts.join(" · ") : "Rest";
  const ai_notes = notes.length > 0 ? notes.join("\n") : day.notes;

  const amT = day.am_session?.trim()
    ? buildWorkoutContractFromSessionText(day.am_session, { slot: "am", source: "onboarding_preview" })
    : null;
  const pmT = day.pm_session?.trim()
    ? buildWorkoutContractFromSessionText(day.pm_session, { slot: "pm", source: "onboarding_preview" })
    : null;

  let targets: PlannedWorkoutTargets | null = null;
  if (amT?.contract && pmT?.contract) {
    targets = {
      contract: {
        version: 1,
        sport: inferWorkoutSport(session_type),
        name: session_type.length > 80 ? `${session_type.slice(0, 77)}…` : session_type,
        source: "onboarding_preview",
        steps: [
          ...amT.contract.steps.map((s) => ({
            ...s,
            label: s.label ? `AM — ${s.label}` : "AM — work",
          })),
          ...pmT.contract.steps.map((s) => ({
            ...s,
            label: s.label ? `PM — ${s.label}` : "PM — work",
          })),
        ],
      },
      target_duration_min:
        (amT.target_duration_min ?? 0) + (pmT.target_duration_min ?? 0) > 0
          ? (amT.target_duration_min ?? 0) + (pmT.target_duration_min ?? 0)
          : null,
      target_hr_zone: amT.target_hr_zone ?? pmT.target_hr_zone,
    };
  } else if (amT) targets = amT;
  else if (pmT) targets = pmT;

  return { session_type, ai_notes: ai_notes || null, targets };
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
