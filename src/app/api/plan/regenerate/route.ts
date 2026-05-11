import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { planGenerationSchema } from "@/lib/training/schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/training/prompts";
import { getRecentActivityStats } from "@/lib/training/generate-plan";

export async function POST(req: NextRequest) {
  if (req.headers.get("authorization") !== "Bearer " + process.env.API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all users with active training plans
  const { data: activePlans, error: plansError } = await supabase
    .from("training_plans")
    .select("id, user_id, split_type, body_goal, race_type, plan_config")
    .eq("status", "active");

  if (plansError) {
    return NextResponse.json({ error: "Failed to fetch active plans" }, { status: 500 });
  }

  // Compute week 2 date range (next Monday + 7 days)
  const nextMonday = new Date();
  const day = nextMonday.getDay();
  nextMonday.setDate(nextMonday.getDate() + (day === 0 ? 1 : 8 - day));
  const week2Monday = new Date(nextMonday);
  week2Monday.setDate(week2Monday.getDate() + 7);
  const week2Sunday = new Date(week2Monday);
  week2Sunday.setDate(week2Sunday.getDate() + 6);

  const week2MondayStr = week2Monday.toISOString().slice(0, 10);
  const week2SundayStr = week2Sunday.toISOString().slice(0, 10);

  const results: Array<{
    userId: string;
    planId: string;
    status: "skipped" | "generated" | "error";
    reason?: string;
  }> = [];

  for (const plan of activePlans || []) {
    try {
      // Skip if week 2 already has planned workouts
      const { data: existingWorkouts } = await supabase
        .from("planned_workouts")
        .select("id")
        .eq("plan_id", plan.id)
        .gte("date", week2MondayStr)
        .lte("date", week2SundayStr)
        .limit(1);

      if (existingWorkouts && existingWorkouts.length > 0) {
        results.push({ userId: plan.user_id, planId: plan.id, status: "skipped", reason: "week 2 already generated" });
        continue;
      }

      // Get user profile and goals
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", plan.user_id).single(),
        supabase.from("user_goals").select("*").eq("user_id", plan.user_id).single(),
      ]);

      if (!profileRes.data || !goalsRes.data) {
        results.push({ userId: plan.user_id, planId: plan.id, status: "error", reason: "missing profile or goals" });
        continue;
      }

      const profile = profileRes.data;
      const goals = goalsRes.data;

      // Get recent activity stats
      const recentActivity = await getRecentActivityStats(plan.user_id);

      // Build user prompt
      const userPrompt = buildUserPrompt({
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        sex: profile.sex,
        experience: profile.training_experience,
        bodyGoal: goals.body_goal,
        emphasis: goals.emphasis,
        daysPerWeek: goals.days_per_week,
        liftingDays: goals.lifting_days,
        trainingForRace: goals.training_for_race,
        raceType: goals.race_type,
        raceDate: goals.race_date,
        goalTime: goals.goal_time,
        doesCardio: goals.does_cardio,
        cardioTypes: goals.cardio_types || [],
        recentActivity,
      });

      // Generate plan for the upcoming week
      const { object: newPlan } = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        schema: planGenerationSchema,
        system: PLAN_SYSTEM_PROMPT,
        prompt: userPrompt + "\n\nGenerate the plan for the upcoming week only (7 days).",
      });

      // Insert planned workouts for week 2
      const workoutRows = newPlan.weekly_layout.map((dayLayout) => ({
        plan_id: plan.id,
        date: new Date(week2Monday.getTime() + dayLayout.day_of_week * 86400000).toISOString().slice(0, 10),
        day_of_week: dayLayout.day_of_week,
        session_type: dayLayout.session_type,
        ai_notes: dayLayout.ai_notes,
        targets: dayLayout.targets || null,
        approved: false,
      }));

      const { error: insertError } = await supabase.from("planned_workouts").insert(workoutRows);

      if (insertError) {
        results.push({ userId: plan.user_id, planId: plan.id, status: "error", reason: insertError.message });
        continue;
      }

      // Post coach message to the user's latest chat conversation
      const { data: latestConvo } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", plan.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestConvo) {
        const sessionSummary = newPlan.weekly_layout
          .map((d) => `- Day ${d.day_of_week + 1}: ${d.session_type}`)
          .join("\n");

        const coachMessage = `Your training plan for next week (starting ${week2MondayStr}) is ready for review!\n\n${sessionSummary}\n\n${newPlan.reasoning}\n\nHead to the Plan tab to approve your sessions.`;

        await supabase.from("chat_messages").insert({
          conversation_id: latestConvo.id,
          role: "assistant",
          content: coachMessage,
        });
      }

      results.push({ userId: plan.user_id, planId: plan.id, status: "generated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      results.push({ userId: plan.user_id, planId: plan.id, status: "error", reason: message });
    }
  }

  return NextResponse.json({ results, week2Monday: week2MondayStr, week2Sunday: week2SundayStr });
}
