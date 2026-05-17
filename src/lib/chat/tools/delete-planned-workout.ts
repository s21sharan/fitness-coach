import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { assertDateNotPast } from "@/lib/training/date-guards";

export function deletePlannedWorkoutTool(userId: string) {
  return tool({
    description:
      "Delete a single planned workout from the user's calendar. Use when the user wants a scheduled session removed entirely (not moved or marked rest). Date must be today or later — past sessions are immutable history. If multiple sessions exist on the date (e.g. AM + PM), pass `name` to disambiguate; otherwise the tool will refuse the delete.",
    inputSchema: z.object({
      date: z
        .string()
        .describe("Date of the workout to delete (YYYY-MM-DD). Must be today or later."),
      name: z
        .string()
        .optional()
        .describe(
          "Optional `session_type` of the row to delete. Required when more than one planned workout exists on that date.",
        ),
    }),
    execute: async ({ date, name }) => {
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

      const baseQuery = supabase
        .from("planned_workouts")
        .select("id, date, session_type")
        .eq("plan_id", plan.id)
        .eq("date", date);

      const { data: matches, error: fetchErr } = name
        ? await baseQuery.eq("session_type", name)
        : await baseQuery;

      if (fetchErr) return { success: false, error: fetchErr.message };
      if (!matches || matches.length === 0) {
        return {
          success: false,
          error: `No planned workout found for ${date}${name ? ` with name "${name}"` : ""}.`,
        };
      }
      if (matches.length > 1) {
        return {
          success: false,
          error: `Multiple planned workouts on ${date} (${matches
            .map((m) => `"${m.session_type}"`)
            .join(", ")}). Pass the \`name\` argument to disambiguate.`,
          candidates: matches.map((m) => ({ id: m.id, session_type: m.session_type })),
        };
      }

      const target = matches[0];
      const { error: delErr } = await supabase
        .from("planned_workouts")
        .delete()
        .eq("id", target.id);
      if (delErr) return { success: false, error: delErr.message };

      return {
        success: true,
        deleted: { date: target.date, session_type: target.session_type, id: target.id },
      };
    },
  });
}
