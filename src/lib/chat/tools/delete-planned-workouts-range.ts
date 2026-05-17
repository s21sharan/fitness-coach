import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { todayYmdLocal } from "@/lib/training/date-guards";

const SPORTS = ["run", "bike", "swim", "strength", "other"] as const;

export function deletePlannedWorkoutsRangeTool(userId: string) {
  return tool({
    description:
      "Delete multiple planned workouts in one shot, by date range with optional filters. Use this — NOT a loop of delete_planned_workout — whenever the user wants a stretch of scheduled sessions removed (\"delete the last two weeks of my plan\", \"scrap all my runs for the next 10 days\"). Only future-dated rows are affected; past sessions are immutable history. The training_blocks table is loose metadata and is never touched by this tool — orphaned block rows are fine.",
    inputSchema: z.object({
      start_date: z
        .string()
        .describe("Inclusive lower bound (YYYY-MM-DD). Past dates are clamped up to today."),
      end_date: z
        .string()
        .describe("Inclusive upper bound (YYYY-MM-DD). Must be on or after start_date."),
      sports: z
        .array(z.enum(SPORTS))
        .optional()
        .describe(
          "Optional sport filter. If provided, only rows whose `targets.contract.sport` matches are deleted. Pass nothing to delete every session in the range.",
        ),
      session_type_includes: z
        .string()
        .optional()
        .describe(
          "Optional substring filter on `session_type` (case-insensitive). E.g. \"run\" matches \"Easy Z2 run\" and \"AM: Long run\".",
        ),
    }),
    execute: async ({ start_date, end_date, sports, session_type_includes }) => {
      if (end_date < start_date) {
        return { success: false, error: `end_date (${end_date}) must be on or after start_date (${start_date}).` };
      }

      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { success: false, error: "No active training plan." };

      const effectiveStart = start_date < todayYmdLocal() ? todayYmdLocal() : start_date;

      // Fetch candidates so we can apply filters that supabase doesn't express
      // in pure SQL (sport lives in targets jsonb, substring needs ilike).
      const { data: candidates, error: fetchErr } = await supabase
        .from("planned_workouts")
        .select("id, date, session_type, targets")
        .eq("plan_id", plan.id)
        .gte("date", effectiveStart)
        .lte("date", end_date);
      if (fetchErr) return { success: false, error: fetchErr.message };

      const needle = session_type_includes?.toLowerCase() ?? null;
      const sportSet = sports && sports.length > 0 ? new Set(sports) : null;
      const matches = (candidates ?? []).filter((row) => {
        if (needle && !String(row.session_type ?? "").toLowerCase().includes(needle)) return false;
        if (sportSet) {
          const targets = row.targets as { contract?: { sport?: string } } | null;
          const sport = targets?.contract?.sport ?? null;
          if (!sport || !sportSet.has(sport as typeof SPORTS[number])) return false;
        }
        return true;
      });

      if (matches.length === 0) {
        return {
          success: true,
          deleted_count: 0,
          message: "No matching planned workouts to delete in that range.",
        };
      }

      const ids = matches.map((m) => m.id as string);
      const { error: delErr } = await supabase
        .from("planned_workouts")
        .delete()
        .in("id", ids);
      if (delErr) return { success: false, error: delErr.message };

      return {
        success: true,
        deleted_count: matches.length,
        deleted: matches.map((m) => ({ id: m.id, date: m.date, session_type: m.session_type })),
        range: { start: effectiveStart, end: end_date },
      };
    },
  });
}
