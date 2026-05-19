import { createServerClient } from "@/lib/supabase/server";

interface DBMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** Convert a DB message to the AI SDK v6 UIMessage shape for useChat */
export function convertDBToUIMessage(msg: DBMessage): {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
  createdAt: Date;
} {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: [{ type: "text", text: msg.content }],
    createdAt: new Date(msg.created_at),
  };
}

export function formatMessagesForAI(messages: DBMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

/**
 * Used by the chat POST route as a defensive fallback. Prefer
 * `createConversation` + an explicit conversationId in the request body.
 */
export async function getOrCreateConversation(userId: string): Promise<string> {
  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId, title: null })
    .select("id")
    .single();
  if (error || !created) throw new Error("Failed to create conversation");
  return created.id;
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("chat_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as ConversationSummary[];
}

export async function createConversation(userId: string, title?: string | null): Promise<ConversationSummary> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId, title: title ?? null })
    .select("id, title, created_at, updated_at")
    .single();
  if (error || !data) throw new Error("Failed to create conversation");
  return data as ConversationSummary;
}

/**
 * Verifies the conversation belongs to the user, then deletes it. Returns
 * `false` if the conversation doesn't exist or belongs to someone else.
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("chat_conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!row || row.user_id !== userId) return false;
  await supabase.from("chat_conversations").delete().eq("id", conversationId);
  return true;
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("chat_conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!row || row.user_id !== userId) return false;
  await supabase
    .from("chat_conversations")
    .update({ title: title.slice(0, 80) })
    .eq("id", conversationId);
  return true;
}

/**
 * Returns true when the given conversation is owned by `userId`. Used by the
 * chat POST route to validate the client-supplied conversationId before
 * appending messages.
 */
export async function conversationBelongsTo(userId: string, conversationId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("chat_conversations")
    .select("user_id")
    .eq("id", conversationId)
    .maybeSingle();
  return !!data && data.user_id === userId;
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

export async function getAllMessages(conversationId: string, limit = 200): Promise<DBMessage[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return data || [];
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

/** Count messages in a conversation. Used to decide when to auto-title. */
export async function countMessages(conversationId: string): Promise<number> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  return count ?? 0;
}

/** Delete all messages in a conversation (keeps the conversation record) */
export async function clearConversation(conversationId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("chat_messages")
    .delete()
    .eq("conversation_id", conversationId);
}
