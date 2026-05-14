import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import {
  getOrCreateConversation,
  getRecentMessages,
  saveMessage,
} from "@/lib/chat/conversation";
import {
  getWorkoutsTool,
  getCardioTool,
  getRecoveryTool,
  getTrainingPlanTool,
  updatePlannedWorkoutTool,
  regeneratePlanTool,
  getSearchResearchTool,
  proposeNextBlockTool,
} from "@/lib/chat/tools";
import { getCheckinHistoryTool } from "@/lib/chat/tools/get-checkin-history";
import { promptCheckinTool } from "@/lib/chat/tools/prompt-checkin";
import { getActiveBlock, getBlockComplianceStats, computeBlockWeekNumber } from "@/lib/training/blocks";

export const maxDuration = 30;

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

  const [profileRes, goalsRes, planRes, todayRecoveryRes, latestGarminCardioRes] =
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
        .from("cardio_logs")
        .select("hr_zones")
        .eq("user_id", userId)
        .eq("is_suppressed", false)
        .not("hr_zones", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const profile = profileRes.data;
  const goals = goalsRes.data;
  const plan = planRes.data;
  const recovery = todayRecoveryRes.data;

  // Parse Garmin zones from the latest activity that has them. Same logic as
  // /api/test-data: we trust whatever Garmin most recently bucketed.
  let hrZones: Array<{ zone: number; low: number; high: number }> | null = null;
  const rawZones = latestGarminCardioRes.data?.hr_zones;
  if (Array.isArray(rawZones) && rawZones.length === 5) {
    const parsed: Array<{ zone: number; low: number; high: number }> = [];
    for (const z of rawZones as Array<{ zone?: number; low?: number; high?: number }>) {
      if (typeof z?.zone === "number" && typeof z?.low === "number" && typeof z?.high === "number") {
        parsed.push({ zone: z.zone, low: z.low, high: z.high });
      }
    }
    if (parsed.length === 5) {
      parsed.sort((a, b) => a.zone - b.zone);
      hrZones = parsed;
    }
  }

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

  // Fetch active block if plan exists
  let blockContext = null;
  if (plan) {
    const activeBlock = await getActiveBlock(plan.id);
    if (activeBlock) {
      const compliance = await getBlockComplianceStats(activeBlock.id);
      const today = new Date().toISOString().slice(0, 10);
      const endDate = new Date(activeBlock.end_date);
      const daysUntilEnd = Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      blockContext = {
        block_type: activeBlock.block_type,
        block_label: activeBlock.block_label,
        block_number: activeBlock.block_number,
        week_count: activeBlock.week_count,
        current_week: computeBlockWeekNumber(activeBlock.start_date, today),
        end_date: activeBlock.end_date,
        days_until_end: Math.max(0, daysUntilEnd),
        compliance_pct: compliance.pct,
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
    weekStats,
    hrZones,
    block: blockContext,
  });

  // Convert UIMessages from client using AI SDK's proper converter
  const finalMessages = messages.length > 0
    ? await convertToModelMessages(messages as UIMessage[])
    : [...(await getRecentMessages(conversationId, 20)).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })), { role: "user" as const, content: lastUserMessage.content }];

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: finalMessages,
    tools: {
      get_workouts: getWorkoutsTool(userId),
      get_cardio: getCardioTool(userId),
      get_recovery: getRecoveryTool(userId),
      get_training_plan: getTrainingPlanTool(userId),
      update_planned_workout: updatePlannedWorkoutTool(userId),
      regenerate_plan: regeneratePlanTool(userId),
      search_research: getSearchResearchTool(),
      propose_next_block: proposeNextBlockTool(userId),
      get_checkin_history: getCheckinHistoryTool(userId),
      prompt_checkin: promptCheckinTool(),
    },
    stopWhen: stepCountIs(5),
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
