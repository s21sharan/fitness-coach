import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import {
  getOrCreateConversation,
  getRecentMessages,
  saveMessage,
  formatMessagesForAI,
} from "@/lib/chat/conversation";
import {
  getNutritionTool,
  getWorkoutsTool,
  getCardioTool,
  getRecoveryTool,
  getWeightTrendTool,
  getTrainingPlanTool,
  updatePlannedWorkoutTool,
} from "@/lib/chat/tools";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await request.json();
  const lastUserMessage = messages[messages.length - 1];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const conversationId = await getOrCreateConversation(userId);
  await saveMessage(conversationId, "user", lastUserMessage.content);

  const [profileRes, goalsRes, planRes, todayRecoveryRes, todayNutritionRes] =
    await Promise.all([
      supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_goals").select("*").eq("user_id", userId).single(),
      supabase
        .from("training_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .single(),
      supabase
        .from("recovery_logs")
        .select("hrv, sleep_hours, resting_hr, body_battery")
        .eq("user_id", userId)
        .eq("date", new Date().toISOString().slice(0, 10))
        .single(),
      supabase
        .from("nutrition_logs")
        .select("calories, protein")
        .eq("user_id", userId)
        .eq("date", new Date().toISOString().slice(0, 10))
        .single(),
    ]);

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const plan = planRes.data;
  const recovery = todayRecoveryRes.data;
  const todayNutrition = todayNutritionRes.data;

  let todaySession: string | null = null;
  if (plan) {
    const { data: todayWorkout } = await supabase
      .from("planned_workouts")
      .select("session_type")
      .eq("plan_id", plan.id)
      .eq("date", new Date().toISOString().slice(0, 10))
      .single();
    todaySession = todayWorkout?.session_type || null;
  }

  let weekStats: {
    sessionsCompleted: number;
    sessionsPlanned: number;
  } | null = null;
  if (plan) {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const mondayStr = monday.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const { data: weekWorkouts } = await supabase
      .from("planned_workouts")
      .select("session_type, status")
      .eq("plan_id", plan.id)
      .gte("date", mondayStr)
      .lte("date", todayStr);

    if (weekWorkouts) {
      const nonRest = weekWorkouts.filter((w) => w.session_type !== "Rest");
      weekStats = {
        sessionsPlanned: nonRest.length,
        sessionsCompleted: nonRest.filter((w) => w.status === "completed")
          .length,
      };
    }
  }

  const systemPrompt = buildSystemPrompt({
    profile: profile
      ? {
          age: profile.age,
          height: profile.height,
          weight: profile.weight,
          sex: profile.sex,
          training_experience: profile.training_experience,
        }
      : {
          age: null,
          height: null,
          weight: null,
          sex: null,
          training_experience: null,
        },
    goals: goals
      ? {
          body_goal: goals.body_goal,
          emphasis: goals.emphasis,
          days_per_week: goals.days_per_week,
          training_for_race: goals.training_for_race,
          race_type: goals.race_type,
          race_date: goals.race_date,
          goal_time: goals.goal_time,
        }
      : {
          body_goal: "general",
          emphasis: null,
          days_per_week: 4,
          training_for_race: false,
          race_type: null,
          race_date: null,
          goal_time: null,
        },
    plan: plan
      ? {
          split_type: plan.split_type,
          plan_config: plan.plan_config as Record<string, unknown>,
        }
      : null,
    todaySession,
    recovery,
    todayNutrition,
    weekStats,
  });

  const recentMessages = await getRecentMessages(conversationId, 20);
  const history = formatMessagesForAI(recentMessages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: [
      ...history,
      { role: "user" as const, content: lastUserMessage.content },
    ],
    tools: {
      get_nutrition: getNutritionTool(userId),
      get_workouts: getWorkoutsTool(userId),
      get_cardio: getCardioTool(userId),
      get_recovery: getRecoveryTool(userId),
      get_weight_trend: getWeightTrendTool(userId),
      get_training_plan: getTrainingPlanTool(userId),
      update_planned_workout: updatePlannedWorkoutTool(userId),
    },
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      if (text) {
        await saveMessage(conversationId, "assistant", text, toolCalls);
      }
    },
  });

  return result.toDataStreamResponse();
}
