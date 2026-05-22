import { generateText, streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import {
  conversationBelongsTo,
  countMessages,
  createConversation,
  getOrCreateConversation,
  getRecentMessages,
  renameConversation,
  saveMessage,
} from "@/lib/chat/conversation";
import {
  getWorkoutsTool,
  getCardioTool,
  getRecoveryTool,
  getTrainingPlanTool,
  updatePlannedWorkoutTool,
  createPlannedWorkoutTool,
  deletePlannedWorkoutTool,
  regeneratePlanTool,
  getSearchResearchTool,
  proposeNextBlockTool,
  createPlannedWorkoutsBatchTool,
  modifyPlannedWorkoutsTool,
  deletePlannedWorkoutsTool,
  swapPlannedWorkoutsTool,
} from "@/lib/chat/tools";
import { getCheckinHistoryTool } from "@/lib/chat/tools/get-checkin-history";
import { promptCheckinTool } from "@/lib/chat/tools/prompt-checkin";
import { buildAthleteContext } from "@/lib/athlete-context/assembler";
import { runChatExtractorJob } from "@/lib/chat/extractor-job";

export const maxDuration = 30;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const messages = body.messages || [];
  const requestedConversationId: string | undefined =
    typeof body.conversationId === "string" ? body.conversationId : undefined;
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

  let conversationId: string;
  let isNewConversation = false;
  if (requestedConversationId && (await conversationBelongsTo(userId, requestedConversationId))) {
    conversationId = requestedConversationId;
    isNewConversation = (await countMessages(conversationId)) === 0;
  } else if (requestedConversationId) {
    // Client supplied an id that isn't theirs / doesn't exist — silently fall back rather than 4xx.
    conversationId = await getOrCreateConversation(userId);
  } else {
    const created = await createConversation(userId);
    conversationId = created.id;
    isNewConversation = true;
  }
  await saveMessage(conversationId, "user", lastUserMessage.content);
  const firstUserMessageForTitle = isNewConversation ? lastUserMessage.content : null;

  // Central Athlete Context: single read of profile, goals, plan, recovery,
  // HR zones, training paces, availability, week stats, active block, the
  // upcoming-14d planned-workouts calendar AND the durable facts memory.
  const ctx = await buildAthleteContext(userId);

  const systemPrompt = buildSystemPrompt({
    profile: ctx.profile,
    goals: ctx.goals,
    plan: ctx.plan
      ? { split_type: ctx.plan.split_type, plan_config: ctx.plan.plan_config }
      : null,
    todaySession: ctx.todaySession,
    recovery: ctx.recovery,
    weekStats: ctx.weekStats,
    hrZones: ctx.hrZones,
    trainingPaces: ctx.trainingPaces,
    block: ctx.block,
    availability: ctx.availability,
    upcomingPlannedSessions: ctx.upcomingPlannedSessions,
    facts: ctx.facts,
  });

  // Convert UIMessages from client using AI SDK's proper converter
  const finalMessages = messages.length > 0
    ? await convertToModelMessages(messages as UIMessage[])
    : [...(await getRecentMessages(conversationId, 20)).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })), { role: "user" as const, content: lastUserMessage.content }];

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: finalMessages,
    tools: {
      get_workouts: getWorkoutsTool(userId),
      get_cardio: getCardioTool(userId),
      get_recovery: getRecoveryTool(userId),
      get_training_plan: getTrainingPlanTool(userId),
      update_planned_workout: updatePlannedWorkoutTool(userId),
      create_planned_workout: createPlannedWorkoutTool(userId),
      delete_planned_workout: deletePlannedWorkoutTool(userId),
      regenerate_plan: regeneratePlanTool(userId),
      search_research: getSearchResearchTool(),
      propose_next_block: proposeNextBlockTool(userId),
      create_planned_workouts_batch: createPlannedWorkoutsBatchTool(userId),
      modify_planned_workouts: modifyPlannedWorkoutsTool(userId),
      delete_planned_workouts: deletePlannedWorkoutsTool(userId),
      swap_planned_workouts: swapPlannedWorkoutsTool(userId),
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
        if (firstUserMessageForTitle) {
          const title = await generateConversationTitle(firstUserMessageForTitle, text);
          if (title) await renameConversation(userId, conversationId, title);
        }
        // Fire-and-forget fact extraction. Failures are logged but never block
        // the response, and durable memory is allowed to lag a few seconds.
        if (text) {
          runChatExtractorJob({
            userId,
            conversationId,
            userMessage: lastUserMessage.content,
            assistantText: text,
          });
        }
      } catch (e) {
        console.error("onFinish error:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    headers: { "x-conversation-id": conversationId },
  });
}

async function generateConversationTitle(userMessage: string, assistantReply: string): Promise<string | null> {
  // Cheap fallback when the model call fails or isn't available.
  const fallback = userMessage.trim().split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || "New chat";
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system:
        "You name a fitness-coach chat thread in 3-6 words. No quotes, no punctuation at the end, no leading 'Chat about'. Output only the title.",
      prompt: `User said: "${userMessage}"\nAssistant replied: "${assistantReply.slice(0, 400)}"`,
      maxOutputTokens: 30,
    });
    const cleaned = text.trim().replace(/^["'`]+|["'`]+$/g, "").slice(0, 60);
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}
