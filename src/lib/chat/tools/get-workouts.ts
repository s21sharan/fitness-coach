import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getWorkoutsTool(userId: string) {
  return tool({
    description:
      "Get strength training workout logs for a date range. Returns exercises, sets, reps, weight. Use when the user asks about their lifting sessions.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("workout_logs")
        .select("date, name, duration_minutes, exercises")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");
      return data || [];
    },
  });
}
