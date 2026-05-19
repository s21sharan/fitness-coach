import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/chat/conversation";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await listConversations(userId);
  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let title: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.title === "string") title = body.title.slice(0, 80);
  } catch {
    // empty body is fine
  }

  const conversation = await createConversation(userId, title);
  return NextResponse.json({ conversation });
}
