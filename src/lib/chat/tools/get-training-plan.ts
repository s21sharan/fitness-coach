import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";

export function getTrainingPlanTool(userId: string) {
  return tool({
    description:
      "Get the user's current training plan including split type, weekly layout, and upcoming sessions. Use when the user asks about their plan, schedule, or what's coming up.",
    parameters: z.object({}),
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
        .select("date, day_of_week, session_type, ai_notes, status, approved")
        .eq("plan_id", plan.id)
        .gte("date", thisMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10))
        .order("date");
      return {
        plan: {
          split_type: plan.split_type,
          body_goal: plan.body_goal,
          race_type: plan.race_type,
          plan_config: plan.plan_config,
        },
        workouts: workouts || [],
      };
    },
  });
}
