import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function resolveConversationId(userId: string, requested: string | null): Promise<string | null> {
  const db = supabase();
  if (requested) {
    const { data } = await db
      .from("chat_conversations")
      .select("id, user_id")
      .eq("id", requested)
      .maybeSingle();
    if (data && data.user_id === userId) return data.id as string;
    return null;
  }
  const { data } = await db
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? (data.id as string) : null;
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const requestedId = url.searchParams.get("conversationId");
  const conversationId = await resolveConversationId(userId, requestedId);
  if (!conversationId) return NextResponse.json({ messages: [], conversationId: null });

  const { data: messages } = await supabase()
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json({ messages: messages ?? [], conversationId });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const requestedId = url.searchParams.get("conversationId");
  const conversationId = await resolveConversationId(userId, requestedId);
  if (!conversationId) return NextResponse.json({ success: true });

  const { error } = await supabase()
    .from("chat_messages")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
  return NextResponse.json({ success: true });
}
