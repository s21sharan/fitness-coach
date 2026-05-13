import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getWeightTrendTool(userId: string) {
  return tool({
    description:
      "Get weigh-in history and EWMA trend weight for a date range. Use when the user asks about their weight or body composition progress.",
    inputSchema: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("weigh_ins")
        .select("date, weight_lbs")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date", { ascending: true });

      const entries = (data ?? []).map((r) => ({ date: r.date as string, weight_lbs: Number(r.weight_lbs) }));

      let trend: number | null = null;
      const trendSeries: { date: string; trend_lbs: number }[] = [];
      for (const e of entries) {
        trend = trend == null ? e.weight_lbs : 0.1 * e.weight_lbs + 0.9 * trend;
        trendSeries.push({ date: e.date, trend_lbs: Number(trend.toFixed(2)) });
      }

      return {
        current_weight_lbs: entries.at(-1)?.weight_lbs ?? null,
        trend_weight_lbs: trend != null ? Number(trend.toFixed(2)) : null,
        delta_lbs: entries.length >= 2 ? Number((entries.at(-1)!.weight_lbs - entries[0].weight_lbs).toFixed(2)) : null,
        entries,
        trend: trendSeries,
      };
    },
  });
}
