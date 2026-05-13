import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return NextResponse.json({ messages: messages || [] });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conversation) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("conversation_id", conversation.id);

  if (error) {
    return NextResponse.json({ error: "Failed to clear chat" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
