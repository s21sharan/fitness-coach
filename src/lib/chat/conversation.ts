import { createServerClient } from "@/lib/supabase/server";

interface DBMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export function formatMessagesForAI(messages: DBMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

export async function getOrCreateConversation(userId: string): Promise<string> {
  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId, title: "Coach" })
    .select("id")
    .single();
  if (error || !created) throw new Error("Failed to create conversation");
  return created.id;
}

export async function getRecentMessages(conversationId: string, limit = 20): Promise<DBMessage[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
): Promise<void> {
  const supabase = createServerClient();
  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls || null,
  });
}
