import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getTrainingPlanTool(userId: string) {
  return tool({
    description:
      "Get the user's current training plan including split type, weekly layout, and upcoming sessions. Use when the user asks about their plan, schedule, or what's coming up.",
    inputSchema: z.object({}),
    execute: async () => {
      const supabase = createServerClient();
      const { data: plan } = await supabase
        .from("training_plans")
        .select("id, split_type, body_goal, race_type, plan_config, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();
      if (!plan) return { plan: null, message: "No active training plan" };
      const now = new Date();
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + mondayOffset);
      const nextSunday = new Date(thisMonday);
      nextSunday.setDate(thisMonday.getDate() + 13);
      const { data: workouts } = await supabase
        .from("planned_workouts")
        .select("id, date, day_of_week, session_type, ai_notes, status, approved, targets, skip_reason")
        .eq("plan_id", plan.id)
        .gte("date", thisMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10))
        .order("date");
      const shaped = (workouts ?? []).map((w) => {
        const targets = (w.targets as { contract?: { sport?: string; slot?: string } } | null) ?? null;
        return {
          id: w.id,
          date: w.date,
          day_of_week: w.day_of_week,
          session_type: w.session_type,
          ai_notes: w.ai_notes,
          status: w.status,
          approved: w.approved,
          skip_reason: w.skip_reason,
          sport: targets?.contract?.sport ?? null,
          slot: targets?.contract?.slot ?? null,
        };
      });
      return {
        plan: {
          split_type: plan.split_type,
          body_goal: plan.body_goal,
          race_type: plan.race_type,
          plan_config: plan.plan_config,
        },
        workouts: shaped,
        hint: "Each workout has an `id` — pass these ids into modify_planned_workouts / delete_planned_workouts / swap_planned_workouts when the user wants to edit specific sessions.",
      };
    },
  });
}
