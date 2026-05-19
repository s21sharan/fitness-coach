import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listAllFactsForUser, archiveFact, updateFactSummary } from "@/lib/athlete-context/facts";

// GET  /api/athlete-facts        → list facts (active first by recency)
// PATCH /api/athlete-facts        → archive or edit a fact's summary
//
// This is the user-facing surface for the "Coach memory" settings tab.
// All inserts come from the extractor pipeline; manual creation isn't
// exposed yet (the coach captures facts implicitly from conversation).

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const facts = await listAllFactsForUser(userId);
  return NextResponse.json({ facts });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    factId: string;
    action: "archive" | "edit";
    summary?: string;
  };
  if (!body?.factId || !body?.action) {
    return NextResponse.json({ error: "factId and action required" }, { status: 400 });
  }

  if (body.action === "archive") {
    const ok = await archiveFact(userId, body.factId);
    return NextResponse.json({ ok });
  }
  if (body.action === "edit") {
    const summary = (body.summary ?? "").trim();
    if (!summary) return NextResponse.json({ error: "summary required" }, { status: 400 });
    const ok = await updateFactSummary(userId, body.factId, summary.slice(0, 280));
    return NextResponse.json({ ok });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
