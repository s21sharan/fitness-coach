import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getNutritionTool(userId: string) {
  return tool({
    description:
      "Get nutrition data (calories, protein, carbs, fat) for a date range. Use when the user asks about their diet, macros, or what they've eaten.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("nutrition_logs")
        .select("date, calories, protein, carbs, fat, fiber")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");
      return data || [];
    },
  });
}
