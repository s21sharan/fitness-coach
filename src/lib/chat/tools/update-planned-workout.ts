import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function updatePlannedWorkoutTool(userId: string) {
  return tool({
    description:
      "Modify a planned workout for a specific date. Can change session type, add notes, or mark as moved. Use when the user wants to swap a session, add a rest day, or adjust their upcoming schedule.",
    parameters: z.object({
      date: z
        .string()
        .describe("Date of the workout to modify in YYYY-MM-DD format"),
      session_type: z
        .string()
        .optional()
        .describe(
          "New session type (e.g. 'Rest', 'Push', 'Easy Run (Zone 2)')"
        ),
      ai_notes: z
        .string()
        .optional()
        .describe("Notes to add to the workout"),
      status: z
        .enum(["scheduled", "moved"])
        .optional()
        .describe("New status"),
    }),
    execute: async ({ date, session_type, ai_notes, status }) => {
      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan" };
      const updates: Record<string, unknown> = {};
      if (session_type !== undefined) updates.session_type = session_type;
      if (ai_notes !== undefined) updates.ai_notes = ai_notes;
      if (status !== undefined) updates.status = status;
      if (Object.keys(updates).length === 0)
        return { success: false, error: "No changes specified" };
      const { data, error } = await supabase
        .from("planned_workouts")
        .update(updates)
        .eq("plan_id", plan.id)
        .eq("date", date)
        .select("date, session_type, ai_notes, status")
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, updated: data };
    },
  });
}
