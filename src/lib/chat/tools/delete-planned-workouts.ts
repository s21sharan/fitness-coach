import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { todayYmdLocal } from "@/lib/training/date-guards";

export function deletePlannedWorkoutsTool(userId: string) {
  return tool({
    description:
      "Delete an arbitrary set of planned workouts identified by their ids. Two-call confirmation flow: (1) call WITHOUT `confirmed: true` to get a preview of which rows would be deleted — summarize for the user — (2) call AGAIN with `confirmed: true` and the same ids to commit. Use this — NOT a loop of delete_planned_workout — whenever the user wants any group of scheduled sessions removed (\"scrap the next 3 runs\", \"delete every lift this week\"). To get ids, call get_training_plan first. Only future-dated rows are affected; past sessions are immutable history. The training_blocks table is loose metadata and is never touched by this tool — orphaned block rows are fine.",
    inputSchema: z.object({
      workout_ids: z
        .array(z.string().uuid())
        .min(1)
        .max(60)
        .describe("Explicit list of planned_workouts.id values to delete. Get them from get_training_plan."),
      confirmed: z
        .boolean()
        .optional()
        .describe(
          "If true, the delete is committed. If false/omitted, returns a preview-only payload (no DB write) — use this first to show the user, then re-call with confirmed=true after they agree.",
        ),
    }),
    execute: async ({ workout_ids, confirmed }) => {
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
        .in("id", workout_ids);
      if (fetchErr) return { success: false, error: fetchErr.message };

      const fetched = candidates ?? [];
      const missing = workout_ids.filter((id) => !fetched.some((r) => String(r.id) === id));
      const matches = fetched.filter((row) => String(row.date) >= today);
      const droppedPast = fetched.length - matches.length;

      if (matches.length === 0) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          match_count: 0,
          dropped_past_count: droppedPast,
          missing_ids: missing,
          message:
            droppedPast > 0
              ? "All targeted workouts are in the past — past sessions are immutable history. Nothing to delete."
              : "No matching planned workouts to delete.",
        };
      }

      const preview = matches.map((m) => ({
        id: String(m.id),
        date: String(m.date),
        session_type: String(m.session_type ?? ""),
      }));

      if (!confirmed) {
        return {
          success: true,
          preview: true,
          confirmed: false,
          committed: false,
          status: "PREVIEW_ONLY_NOT_COMMITTED",
          match_count: matches.length,
          dropped_past_count: droppedPast,
          missing_ids: missing,
          to_delete: preview,
          hint: "THIS IS A PREVIEW — NO DATABASE WRITE HAS HAPPENED. The calendar is unchanged. Summarize for the user, get their confirmation, then call this tool AGAIN with identical ids PLUS confirmed:true to actually commit. Do NOT tell the user the deletions are done until you have made the second call and received a response with confirmed:true.",
        };
      }

      const ids = matches.map((m) => m.id as string);
      const { error: delErr } = await supabase
        .from("planned_workouts")
        .delete()
        .in("id", ids);
      if (delErr) return { success: false, error: delErr.message };

      return {
        success: true,
        confirmed: true,
        deleted_count: matches.length,
        dropped_past_count: droppedPast,
        missing_ids: missing,
        deleted: preview,
      };
    },
  });
}
