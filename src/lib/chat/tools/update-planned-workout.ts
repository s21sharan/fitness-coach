import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { workoutContractSchema } from "@/lib/training/schemas";
import { assertDateNotPast } from "@/lib/training/date-guards";
import { estimateDurationMin, type WorkoutContractV1 } from "@/lib/training/workout-contract";

export function updatePlannedWorkoutTool(userId: string) {
  return tool({
    description:
      "Modify a planned workout for a specific date (today or later). Can change the display name, swap in a new structured contract, edit notes, or mark moved/rest. Use for tweaks on an existing scheduled session. To add a new session, use create_planned_workout instead.",
    inputSchema: z.object({
      date: z
        .string()
        .describe("Date of the workout to modify (YYYY-MM-DD). Past dates are read-only."),
      name: z
        .string()
        .optional()
        .describe('New display label for the session (e.g. "Easy Z2 run", "Rest").'),
      session_type: z
        .string()
        .optional()
        .describe(
          "Legacy display string for the session (e.g. 'Rest', 'Push'). Prefer `name` when also passing a contract."
        ),
      contract: workoutContractSchema
        .optional()
        .describe(
          "Replace the structured contract for this session. Provide when restructuring the workout (sport, steps, durations, targets)."
        ),
      ai_notes: z
        .string()
        .optional()
        .describe("Notes / rationale to attach to the workout."),
      status: z
        .enum(["scheduled", "moved", "skipped"])
        .optional()
        .describe(
          "New status. Use 'skipped' to mark the session as deliberately skipped (provide skip_reason). Use 'scheduled' to revert a skip back to active."
        ),
      skip_reason: z
        .string()
        .optional()
        .describe(
          "When status='skipped', a short reason (illness, travel, soreness, etc.) the coach will reference when planning around the gap."
        ),
    }),
    execute: async ({ date, name, session_type, contract, ai_notes, status, skip_reason }) => {
      const guard = assertDateNotPast(date);
      if (!guard.ok) return { success: false, error: guard.error };

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan" };

      const updates: Record<string, unknown> = {};
      const newSessionType = name ?? session_type;
      if (newSessionType !== undefined) updates.session_type = newSessionType;
      if (ai_notes !== undefined) updates.ai_notes = ai_notes;
      if (status !== undefined) updates.status = status;
      if (status === "skipped") {
        updates.skip_reason = skip_reason?.trim().slice(0, 2000) || null;
        updates.skipped_at = new Date().toISOString();
      } else if (status === "scheduled" || status === "moved") {
        // Reverting to active wipes any stale skip context so the prompt
        // doesn't keep surfacing an outdated "skipped because…" line.
        updates.skip_reason = null;
        updates.skipped_at = null;
      }

      if (contract !== undefined) {
        const { data: existing } = await supabase
          .from("planned_workouts")
          .select("targets")
          .eq("plan_id", plan.id)
          .eq("date", date)
          .maybeSingle();
        const prevTargets = (existing?.targets as Record<string, unknown> | null) ?? {};
        const normalizedContract: WorkoutContractV1 = {
          ...(contract as unknown as WorkoutContractV1),
          source: "coach",
        };
        updates.targets = {
          ...prevTargets,
          contract: normalizedContract,
          target_duration_min: estimateDurationMin(normalizedContract.steps),
        };
      }

      if (Object.keys(updates).length === 0)
        return { success: false, error: "No changes specified" };

      const { data, error } = await supabase
        .from("planned_workouts")
        .update(updates)
        .eq("plan_id", plan.id)
        .eq("date", date)
        .select("id, date, session_type, ai_notes, status, targets, skip_reason")
        .single();
      if (error) return { success: false, error: error.message };

      // When the coach marks a session as skipped, also unlink any actual log
      // that the matcher previously linked — keeping the planned row in a
      // contradictory state (skipped but still pointing at an actual) would
      // confuse compliance and the next sync.
      if (data && status === "skipped") {
        const now = new Date().toISOString();
        await supabase
          .from("workout_logs")
          .update({ planned_workout_id: null, unmatched_at: now })
          .eq("planned_workout_id", data.id);
        await supabase
          .from("cardio_logs")
          .update({ planned_workout_id: null, unmatched_at: now })
          .eq("planned_workout_id", data.id);
      }

      return { success: true, updated: data };
    },
  });
}
