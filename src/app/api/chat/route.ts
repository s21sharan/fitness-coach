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
  regeneratePlanTool,
  getSearchResearchTool,
} from "@/lib/chat/tools";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const messages = body.messages || [];
  const lastMsg = messages[messages.length - 1];

  // v6 UIMessage format: { role, parts: [{ type: "text", text: "..." }] }
  // v5 format: { role, content: "..." }
  let userText: string;
  if (lastMsg.content) {
    userText = lastMsg.content;
  } else if (lastMsg.parts) {
    userText = lastMsg.parts
      .filter((p: { type: string; text?: string }) => p.type === "text")
      .map((p: { text: string }) => p.text)
      .join("");
  } else {
    userText = "";
  }
  const lastUserMessage = { role: lastMsg.role, content: userText };

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

  // Convert incoming UIMessages to ModelMessages for streamText
  const modelMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of messages) {
    let text = "";
    if (msg.content) {
      text = msg.content;
    } else if (msg.parts) {
      text = msg.parts
        .filter((p: { type: string; text?: string }) => p.type === "text")
        .map((p: { text: string }) => p.text)
        .join("");
    }
    if (text && (msg.role === "user" || msg.role === "assistant")) {
      modelMessages.push({ role: msg.role, content: text });
    }
  }

  // If no messages from client, fall back to DB history
  const finalMessages = modelMessages.length > 0
    ? modelMessages
    : [...(await getRecentMessages(conversationId, 20)).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })), { role: "user" as const, content: lastUserMessage.content }];

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: finalMessages,
    tools: {
      get_nutrition: getNutritionTool(userId),
      get_workouts: getWorkoutsTool(userId),
      get_cardio: getCardioTool(userId),
      get_recovery: getRecoveryTool(userId),
      get_weight_trend: getWeightTrendTool(userId),
      get_training_plan: getTrainingPlanTool(userId),
      update_planned_workout: updatePlannedWorkoutTool(userId),
      regenerate_plan: regeneratePlanTool(userId),
      search_research: getSearchResearchTool(),
    },
    maxSteps: 5,
    onFinish: async (event) => {
      try {
        const text = event.text || "";
        if (text) {
          await saveMessage(conversationId, "assistant", text, event.toolCalls);
        }
      } catch (e) {
        console.error("onFinish error:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
