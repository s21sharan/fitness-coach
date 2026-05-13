import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getNutritionTool(userId: string) {
  return tool({
    description:
      "Get nutrition data (calories, protein, carbs, fat) for a date range. Use when the user asks about their diet, macros, or what they've eaten.",
    inputSchema: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("food_log_entries")
        .select("logged_at, calories, protein, carbs, fat, fiber")
        .eq("user_id", userId)
        .gte("logged_at", `${start_date}T00:00:00Z`)
        .lte("logged_at", `${end_date}T23:59:59Z`);

      const byDate = new Map<string, { date: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }>();
      for (const row of data ?? []) {
        const d = (row.logged_at as string).slice(0, 10);
        const agg = byDate.get(d) ?? { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        agg.calories += Number(row.calories) || 0;
        agg.protein += Number(row.protein) || 0;
        agg.carbs += Number(row.carbs) || 0;
        agg.fat += Number(row.fat) || 0;
        agg.fiber += Number(row.fiber) || 0;
        byDate.set(d, agg);
      }
      return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
