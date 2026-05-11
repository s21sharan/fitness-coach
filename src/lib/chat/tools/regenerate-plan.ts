import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { planGenerationSchema, type DayLayout } from "@/lib/training/schemas";
import { getRecentActivityStats } from "@/lib/training/generate-plan";

const PLAN_SYSTEM_PROMPT = `You are an expert fitness coach building a weekly training plan.
Generate a concrete 7-day weekly layout based on the user's request.
Each day must have a session_type (e.g. "Chest/Back", "Arms", "Legs", "Easy Run (Zone 2)", "Long Run", "Swim", "Brick Run", "Rest").
Be specific with session names. Include ai_notes with brief coaching cues for each session.
The plan should be practical and well-periodized — hard days followed by easy days, no back-to-back heavy sessions.
IMPORTANT: Consider the user's recent workout history — do NOT schedule the same muscle group they just trained. Space out similar sessions.`;

export function regeneratePlanTool(userId: string) {
  return tool({
    description:
      "Generate a proposed training plan based on the user's request. This does NOT save it — it returns a proposal for the user to review and approve. Use when the user wants to change their training split, restructure their week, or create a new plan.",
    inputSchema: z.object({
      user_request: z
        .string()
        .describe("The user's full description of what they want their training plan to look like"),
      split_type: z
        .enum(["full_body", "upper_lower", "ppl", "arnold", "phul", "bro_split", "hybrid_upper_lower", "hybrid_nick_bare"])
        .describe("The closest matching split type for the new plan"),
      days_per_week: z
        .number()
        .min(3)
        .max(7)
        .describe("Total training days per week"),
    }),
    execute: async ({ user_request, split_type, days_per_week }) => {
      const supabase = createServerClient();

      // Get user profile for context
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_goals").select("*").eq("user_id", userId).single(),
      ]);

      const profile = profileRes.data;
      const goals = goalsRes.data;

      // Get recent activity stats
      const recentActivity = await getRecentActivityStats(userId);

      // Get last 7 days of actual workouts for sequencing context
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sinceStr = sevenDaysAgo.toISOString().slice(0, 10);

      const [workoutRes, cardioRes] = await Promise.all([
        supabase.from("workout_logs").select("date, name").eq("user_id", userId).gte("date", sinceStr).order("date", { ascending: false }),
        supabase.from("cardio_logs").select("date, type, distance").eq("user_id", userId).gte("date", sinceStr).order("date", { ascending: false }),
      ]);

      const recentWorkouts = workoutRes.data || [];
      const recentCardio = cardioRes.data || [];

      // Build context
      const contextParts: string[] = [];
      if (profile) {
        contextParts.push(`Athlete: ${profile.age}yo ${profile.sex}, ${profile.weight}lbs, ${profile.training_experience} experience`);
      }
      if (goals) {
        contextParts.push(`Goal: ${goals.body_goal}`);
      }
      if (recentActivity) {
        if (recentActivity.weeklyRunCount > 0) contextParts.push(`Currently running ~${recentActivity.weeklyRunCount}x/week`);
        if (recentActivity.weeklyLiftCount > 0) contextParts.push(`Currently lifting ~${recentActivity.weeklyLiftCount}x/week`);
        if (recentActivity.avgHrv) contextParts.push(`Avg HRV: ${recentActivity.avgHrv}`);
        if (recentActivity.avgSleepHours) contextParts.push(`Avg sleep: ${recentActivity.avgSleepHours}h`);
      }

      // Add recent workout history
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      if (recentWorkouts.length > 0 || recentCardio.length > 0) {
        contextParts.push(`\nRecent workouts (last 7 days):`);
        for (const w of recentWorkouts) {
          contextParts.push(`  ${w.date}: ${w.name} (lifting)`);
        }
        for (const c of recentCardio) {
          contextParts.push(`  ${c.date}: ${c.type}${c.distance ? ` ${c.distance}km` : ""}`);
        }
        contextParts.push(`Today is ${dayNames[dayOfWeek]} (${todayStr}). The new plan starts next Monday. Schedule accordingly so there's no overlap with what they just did.`);
      }

      const prompt = `${contextParts.join("\n")}

The user wants to change their plan to: ${user_request}

Generate a 7-day weekly layout (Monday=0 through Sunday=6) with ${days_per_week} active training days. Be specific with session types.`;

      // Generate plan via Claude (proposal only — NOT saved)
      const { object: plan } = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        schema: planGenerationSchema,
        system: PLAN_SYSTEM_PROMPT,
        prompt,
      });

      // Format for display — do NOT save to database
      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const layout = plan.weekly_layout.map((d: DayLayout) => ({
        day: dayLabels[d.day_of_week],
        session: d.session_type,
        notes: d.ai_notes,
      }));

      return {
        success: true,
        proposed: true,
        split_type: split_type,
        reasoning: plan.reasoning,
        weekly_layout: layout,
        raw_layout: plan.weekly_layout,
        plan_config: plan.plan_config,
        body_goal: goals?.body_goal || "general_fitness",
        race_type: goals?.race_type || null,
      };
    },
  });
}
