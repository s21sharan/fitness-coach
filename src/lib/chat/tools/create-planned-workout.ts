import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { workoutContractSchema, type SessionContract } from "@/lib/training/schemas";
import { assertDateNotPast } from "@/lib/training/date-guards";
import { estimateDurationMin, type WorkoutContractV1 } from "@/lib/training/workout-contract";

const SLOT_VALUES = ["am", "pm", "full"] as const;

export function createPlannedWorkoutTool(userId: string) {
  return tool({
    description:
      "Schedule a single new workout on a specific date (today or later). Use for one-off additions like 'add an easy Z2 run for Friday'. Requires a structured contract (sport, name, steps with durations/zones — or exercise_name/sets/reps for strength). Granularity is flexible: a single 'work' step with duration_sec is fine when the user is vague. Reject if a session already exists for that date unless replace_existing=true.",
    inputSchema: z.object({
      date: z
        .string()
        .describe("Date to schedule on (YYYY-MM-DD). Must be today or in the future."),
      slot: z
        .enum(SLOT_VALUES)
        .optional()
        .describe("Which slot of the day: am, pm, or full. Defaults to full."),
      name: z
        .string()
        .min(1)
        .max(60)
        .describe('Short display label, e.g. "Easy Z2 run" or "Lower body lift".'),
      sport: z
        .enum(["run", "bike", "swim", "strength", "other"])
        .describe("Sport for this session. Use 'other' for mobility, yoga, stretching, or anything that doesn't fit the four primary sports."),
      contract: workoutContractSchema.describe(
        "Structured FIT-inspired contract: ordered steps (warmup/work/recovery/cooldown/rest/repeat) with durations and targets. For strength, prefer work steps with exercise_name + sets + reps when specifics are known."
      ),
      ai_notes: z
        .string()
        .nullable()
        .optional()
        .describe("Coaching rationale or short note for this session."),
      replace_existing: z
        .boolean()
        .optional()
        .describe("If true, overwrite an existing scheduled session for that date. Default false."),
    }),
    execute: async ({ date, slot, name, sport, contract, ai_notes, replace_existing }) => {
      const guard = assertDateNotPast(date);
      if (!guard.ok) return { success: false, error: guard.error };

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan." };

      const normalizedContract: WorkoutContractV1 = {
        ...(contract as unknown as WorkoutContractV1),
        source: "coach",
        slot: slot ?? contract.slot ?? "full",
        name,
        sport,
      };
      const targets = {
        contract: normalizedContract,
        target_duration_min: estimateDurationMin(normalizedContract.steps),
      };

      const dow = jsDayToMon0(new Date(date + "T00:00:00").getDay());

      const { data: existing } = await supabase
        .from("planned_workouts")
        .select("id, date, session_type, targets")
        .eq("plan_id", plan.id)
        .eq("date", date)
        .maybeSingle();

      if (existing && !replace_existing) {
        return {
          success: false,
          exists: true,
          message: `A workout is already scheduled for ${date} (${existing.session_type}). Confirm with the user, then call again with replace_existing=true.`,
          existing: {
            date: existing.date,
            session_type: existing.session_type,
            targets: existing.targets,
          },
        };
      }

      const sessionContractValue: SessionContract = {
        sport,
        name,
        rationale: ai_notes ?? null,
        contract: normalizedContract,
      };

      if (existing) {
        const { data, error } = await supabase
          .from("planned_workouts")
          .update({
            session_type: name,
            ai_notes: ai_notes ?? null,
            targets: targets as unknown as Record<string, unknown>,
            status: "scheduled",
            approved: true,
            day_of_week: dow,
          })
          .eq("id", existing.id)
          .select("date, session_type, ai_notes, targets")
          .single();
        if (error) return { success: false, error: error.message };
        return { success: true, replaced: true, session: sessionContractValue, saved: data };
      }

      const { data, error } = await supabase
        .from("planned_workouts")
        .insert({
          plan_id: plan.id,
          date,
          day_of_week: dow,
          session_type: name,
          ai_notes: ai_notes ?? null,
          targets: targets as unknown as Record<string, unknown>,
          status: "scheduled",
          approved: true,
        })
        .select("date, session_type, ai_notes, targets")
        .single();
      if (error) return { success: false, error: error.message };

      return { success: true, created: true, session: sessionContractValue, saved: data };
    },
  });
}

/** Convert JS Sun=0..Sat=6 to Mon=0..Sun=6 (matches existing planned_workouts.day_of_week). */
function jsDayToMon0(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
