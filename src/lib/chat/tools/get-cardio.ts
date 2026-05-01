import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getCardioTool(userId: string) {
  return tool({
    description:
      "Get cardio activity logs (runs, rides, swims) for a date range. Returns distance, duration, pace, heart rate. Use when the user asks about their cardio or endurance training.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("cardio_logs")
        .select(
          "date, type, distance, duration, avg_hr, pace_or_speed, calories, elevation"
        )
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");
      return data || [];
    },
  });
}
