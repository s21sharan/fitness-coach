import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";
import { gatherWeekData, type WeekData } from "./gather-data.js";
import { weeklyAdjustmentSchema } from "./schemas.js";

const ADJUSTMENT_SYSTEM_PROMPT = `You are a fitness coach analyzing a client's past week and adjusting their plan.
Review their compliance, recovery, nutrition, and performance data.
Propose adjustments for next week. Be specific about what to change and why.
Do not make changes unless the data supports it.

Session type examples:
- Lifting: "Push", "Pull", "Legs", "Upper Body", "Lower Body", "Full Body", "Chest + Back", "Shoulders + Arms"
- Cardio: "Easy Run (Zone 2)", "Tempo Run", "Intervals", "Long Run", "Long Ride", "Swim", "Long Ride + Brick Run"
- Multi-session: "Upper Body + Easy Run (Zone 2)"
- Rest: "Rest"

day_of_week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday`;

interface AdjustmentInput {
  splitType: string;
  bodyGoal: string | null;
  raceType: string | null;
  planConfig: Record<string, unknown> | null;
  weekData: WeekData;
}

export function buildAdjustmentPrompt(input: AdjustmentInput): string {
  const { splitType, bodyGoal, raceType, planConfig, weekData } = input;
  const lines: string[] = [];

  lines.push(`Current split: ${splitType}`);
  if (bodyGoal) lines.push(`Goal: ${bodyGoal}`);
  if (raceType) lines.push(`Training for: ${raceType}`);
  if (planConfig?.periodization_phase) lines.push(`Phase: ${planConfig.periodization_phase}`);
  if (planConfig?.race_weeks_out) lines.push(`Race in ${planConfig.race_weeks_out} weeks`);
  lines.push("");

  lines.push(`=== LAST WEEK SUMMARY ===`);
  lines.push(`Compliance: ${weekData.compliance}%`);
  lines.push(`Avg calories: ${weekData.avgCalories}`);
  lines.push(`Avg protein: ${weekData.avgProtein}g`);
  if (weekData.avgSleepHours !== null) lines.push(`Avg sleep: ${weekData.avgSleepHours}h`);
  if (weekData.avgHrv !== null) lines.push(`Avg HRV: ${weekData.avgHrv}`);
  lines.push("");

  if (weekData.planned.length > 0) {
    lines.push("Planned sessions:");
    for (const p of weekData.planned) {
      lines.push(`  ${p.date} (day ${p.day_of_week}): ${p.session_type} — ${p.status}`);
    }
    lines.push("");
  }

  if (weekData.workoutLogs.length > 0) {
    lines.push("Lifting logs:");
    for (const w of weekData.workoutLogs) {
      const exercises = Array.isArray(w.exercises) ? w.exercises : [];
      lines.push(`  ${w.date}: ${w.name} — ${w.duration_minutes} min, ${exercises.length} exercises`);
    }
    lines.push("");
  }

  if (weekData.cardioLogs.length > 0) {
    lines.push("Cardio logs:");
    for (const c of weekData.cardioLogs) {
      lines.push(`  ${c.date}: ${c.type} — ${c.distance}km, ${Math.round(c.duration / 60)} min${c.avg_hr ? `, ${c.avg_hr} bpm` : ""}`);
    }
    lines.push("");
  }

  if (weekData.recoveryLogs.length > 0) {
    lines.push("Recovery data:");
    for (const r of weekData.recoveryLogs) {
      const parts = [];
      if (r.hrv !== null) parts.push(`HRV ${r.hrv}`);
      if (r.sleep_hours !== null) parts.push(`Sleep ${r.sleep_hours}h`);
      if (r.resting_hr !== null) parts.push(`RHR ${r.resting_hr}`);
      if (r.body_battery !== null) parts.push(`BB ${r.body_battery}`);
      if (parts.length > 0) lines.push(`  ${r.date}: ${parts.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("Generate next week's plan based on this data. Keep the same split structure unless data suggests a change.");

  return lines.join("\n");
}

export async function runWeeklyCheckIn(userId: string, planId: string): Promise<void> {
  const now = new Date();
  const day = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
  const weekStartDate = lastMonday.toISOString().slice(0, 10);

  const { data: plan } = await supabase
    .from("training_plans")
    .select("split_type, body_goal, race_type, plan_config")
    .eq("id", planId)
    .single();

  if (!plan) {
    logger.error("Plan not found for check-in", { planId });
    return;
  }

  const weekData = await gatherWeekData(userId, planId, weekStartDate);

  const prompt = buildAdjustmentPrompt({
    splitType: plan.split_type,
    bodyGoal: plan.body_goal,
    raceType: plan.race_type,
    planConfig: plan.plan_config as Record<string, unknown>,
    weekData,
  });

  const { object: adjustment } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: weeklyAdjustmentSchema,
    system: ADJUSTMENT_SYSTEM_PROMPT,
    prompt,
  });

  const { error: insertError } = await supabase
    .from("weekly_check_ins")
    .insert({
      user_id: userId,
      plan_id: planId,
      week_start_date: weekStartDate,
      compliance_pct: adjustment.compliance_pct,
      avg_calories: weekData.avgCalories,
      avg_protein: weekData.avgProtein,
      avg_sleep_hours: weekData.avgSleepHours,
      avg_hrv: weekData.avgHrv,
      ai_summary: adjustment.summary,
      adjustments: adjustment.adjustments,
      risk_flags: adjustment.risk_flags,
      next_week_layout: adjustment.next_week_layout,
      user_approved: null,
    });

  if (insertError) {
    logger.error("Failed to insert check-in", { error: String(insertError) });
    return;
  }

  const nextMonday = new Date(lastMonday);
  nextMonday.setDate(nextMonday.getDate() + 14);

  const workouts = adjustment.next_week_layout.map((day) => {
    const date = new Date(nextMonday);
    date.setDate(date.getDate() + day.day_of_week);
    return {
      plan_id: planId,
      date: date.toISOString().slice(0, 10),
      day_of_week: day.day_of_week,
      session_type: day.session_type,
      ai_notes: day.ai_notes,
      status: "scheduled",
      approved: false,
    };
  });

  await supabase.from("planned_workouts").insert(workouts);

  logger.info("Weekly check-in completed", { userId, planId, compliance: adjustment.compliance_pct });
}

export async function runAllWeeklyCheckIns(): Promise<void> {
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, user_id")
    .eq("status", "active");

  if (!plans || plans.length === 0) {
    logger.info("No active plans for weekly check-in");
    return;
  }

  for (const plan of plans) {
    try {
      await runWeeklyCheckIn(plan.user_id, plan.id);
    } catch (err) {
      logger.error("Weekly check-in failed", { userId: plan.user_id, planId: plan.id, error: String(err) });
    }
  }
}
