import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteConversation, renameConversation } from "@/lib/chat/conversation";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const ok = await deleteConversation(userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const ok = await renameConversation(userId, id, title);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
