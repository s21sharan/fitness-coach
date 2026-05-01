import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getRecoveryTool(userId: string) {
  return tool({
    description:
      "Get recovery data (HRV, sleep hours, sleep score, resting heart rate, body battery, stress level, steps) for a date range. Use when the user asks about their recovery, sleep, or readiness to train.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("recovery_logs")
        .select(
          "date, hrv, sleep_hours, sleep_score, resting_hr, body_battery, stress_level, steps"
        )
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");
      return data || [];
    },
  });
}
