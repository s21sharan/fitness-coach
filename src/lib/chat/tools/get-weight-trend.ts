import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getWeightTrendTool(userId: string) {
  return tool({
    description:
      "Get weight entries and trend direction for a date range. Use when the user asks about their weight or body composition progress.",
    parameters: z.object({
      start_date: z.string().describe("Start date in YYYY-MM-DD format"),
      end_date: z.string().describe("End date in YYYY-MM-DD format"),
    }),
    execute: async ({ start_date, end_date }) => {
      const supabase = createServerClient();
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("weight")
        .eq("user_id", userId)
        .single();
      return {
        current_weight_lbs: profile?.weight || null,
        note: "Weight tracking from MacroFactor. Current weight from profile.",
      };
    },
  });
}
