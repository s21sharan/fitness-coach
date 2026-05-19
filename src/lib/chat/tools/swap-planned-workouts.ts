import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { workoutContractSchema } from "@/lib/training/schemas";
import { assertDateNotPast, todayYmdLocal } from "@/lib/training/date-guards";
import { estimateDurationMin, type WorkoutContractV1 } from "@/lib/training/workout-contract";

const SLOTS = ["am", "pm", "full"] as const;
const SPORTS = ["run", "bike", "swim", "strength", "other"] as const;

const newSessionSchema = z.object({
  date: z.string().describe("Date for this new session (YYYY-MM-DD). Must be today or later."),
  slot: z.enum(SLOTS).optional().describe("Time-of-day slot. Defaults to 'full'."),
  sport: z.enum(SPORTS),
  name: z.string().min(1).max(60).describe('Short display label (e.g. "Upper push", "Easy Z2 run").'),
  contract: workoutContractSchema.describe("Structured contract: ordered steps with durations and targets."),
  ai_notes: z.string().nullable().optional(),
});

export function swapPlannedWorkoutsTool(userId: string) {
  return tool({
    description:
      "Atomically replace a set of planned workouts with brand-new sessions in one call. This is the right tool for ‘change my lifting split this week’ — pass in the ids of every existing lift session to remove, and the array of new lift sessions to insert. The endurance workouts in the plan are NOT touched. Two-call confirmation flow: (1) call WITHOUT `confirmed: true` to preview the swap (what's being removed, what's being added) — relay this to the user — (2) call AGAIN with `confirmed: true` and the same arguments to commit. Get the ids to remove from get_training_plan. Only future-dated rows can be removed; the new sessions must also be dated today or later. The training_blocks table is loose metadata and is never touched.",
    inputSchema: z.object({
      workout_ids_to_replace: z
        .array(z.string().uuid())
        .min(1)
        .max(40)
        .describe("planned_workouts.id values to remove. Pull these from get_training_plan."),
      new_sessions: z
        .array(newSessionSchema)
        .min(1)
        .max(40)
        .describe("Replacement sessions to insert. Each must include a contract."),
      confirmed: z
        .boolean()
        .optional()
        .describe(
          "If true, the swap is committed in one batch. If false/omitted, returns a preview-only payload — use this first to show the user, then re-call with confirmed=true after they agree.",
        ),
    }),
    execute: async ({ workout_ids_to_replace, new_sessions, confirmed }) => {
      // Validate the new session dates up front.
      for (const s of new_sessions) {
        const guard = assertDateNotPast(s.date);
        if (!guard.ok) return { success: false, error: `New session "${s.name}" on ${s.date}: ${guard.error}` };
      }

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan." };

      const today = todayYmdLocal();

      const { data: candidates, error: fetchErr } = await supabase
        .from("planned_workouts")
        .select("id, date, session_type, targets")
        .eq("plan_id", plan.id)
        .in("id", workout_ids_to_replace);
      if (fetchErr) return { success: false, error: fetchErr.message };

      const fetched = candidates ?? [];
      const missing = workout_ids_to_replace.filter((id) => !fetched.some((r) => String(r.id) === id));
      const removable = fetched.filter((row) => String(row.date) >= today);
      const droppedPast = fetched.length - removable.length;

      const removalPreview = removable.map((m) => ({
        id: String(m.id),
        date: String(m.date),
        session_type: String(m.session_type ?? ""),
      }));

      const additionsPreview = new_sessions.map((s) => ({
        date: s.date,
        slot: s.slot ?? "full",
        sport: s.sport,
        name: s.name,
        ai_notes: s.ai_notes ?? null,
        estimated_duration_min: estimateDurationMin(s.contract.steps as WorkoutContractV1["steps"]),
      }));

      if (!confirmed) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          committed: false,
          status: "PREVIEW_ONLY_NOT_COMMITTED",
          removing_count: removable.length,
          adding_count: new_sessions.length,
          dropped_past_count: droppedPast,
          missing_ids: missing,
          removing: removalPreview,
          adding: additionsPreview,
          hint: "THIS IS A PREVIEW — NO DATABASE WRITE HAS HAPPENED. The calendar is unchanged. Summarize the swap for the user, get their confirmation, then call this tool AGAIN with identical arguments PLUS confirmed:true to actually commit. Do NOT tell the user the change is done until you have made the second call and received a response with confirmed:true.",
        };
      }

      // Commit phase. Delete first, insert second. Each step is a single Supabase call.
      let deletedCount = 0;
      if (removable.length > 0) {
        const ids = removable.map((m) => m.id as string);
        const { error: delErr } = await supabase
          .from("planned_workouts")
          .delete()
          .in("id", ids);
        if (delErr) return { success: false, error: `Delete phase failed: ${delErr.message}` };
        deletedCount = removable.length;
      }

      const rowsToInsert = new_sessions.map((s) => {
        const slot = s.slot ?? s.contract.slot ?? "full";
        const normalized: WorkoutContractV1 = {
          ...(s.contract as unknown as WorkoutContractV1),
          source: "coach",
          slot,
          name: s.name,
          sport: s.sport,
        };
        const dow = jsDayToMon0(new Date(s.date + "T00:00:00").getDay());
        return {
          plan_id: plan.id,
          date: s.date,
          day_of_week: dow,
          session_type: s.name,
          ai_notes: s.ai_notes ?? null,
          targets: {
            contract: normalized,
            target_duration_min: estimateDurationMin(normalized.steps),
          } as unknown as Record<string, unknown>,
          status: "scheduled",
          approved: true,
        };
      });

      const { data: inserted, error: insErr } = await supabase
        .from("planned_workouts")
        .insert(rowsToInsert)
        .select("id, date, session_type");
      if (insErr) {
        return {
          success: false,
          partial: true,
          deleted_count: deletedCount,
          error: `Insert phase failed after delete: ${insErr.message}. ${deletedCount} rows were already removed.`,
        };
      }

      return {
        success: true,
        confirmed: true,
        deleted_count: deletedCount,
        inserted_count: inserted?.length ?? 0,
        dropped_past_count: droppedPast,
        missing_ids: missing,
        removed: removalPreview,
        added: (inserted ?? []).map((r) => ({
          id: String(r.id),
          date: String(r.date),
          session_type: String(r.session_type ?? ""),
        })),
      };
    },
  });
}

function jsDayToMon0(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}
