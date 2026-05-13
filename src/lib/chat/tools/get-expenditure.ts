import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getExpenditureTool(userId: string) {
  return tool({
    description:
      "Get daily energy expenditure (wearable kcal, estimated kcal, final TDEE, correction factor) for a date range. Use to evaluate energy balance vs. nutrition.",
    inputSchema: z.object({
      start_date: z.string(),
      end_date: z.string(),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("expenditure_daily")
        .select("date, wearable_kcal, estimated_kcal, tdee_kcal, correction_k, source")
        .eq("user_id", userId)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date");

      const rows = data ?? [];
      const withValue = rows
        .map((r) => Number(r.tdee_kcal ?? r.wearable_kcal ?? r.estimated_kcal))
        .filter((v) => Number.isFinite(v));
      const avg = withValue.length > 0 ? withValue.reduce((a, b) => a + b, 0) / withValue.length : null;
      const k = rows.at(-1)?.correction_k ?? null;

      return {
        days: rows,
        average_tdee_kcal: avg != null ? Math.round(avg) : null,
        latest_correction_k: k,
      };
    },
  });
}
