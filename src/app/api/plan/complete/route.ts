import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runNoteExtractorJob } from "@/lib/chat/extractor-job";

// Mark a planned session as completed and / or attach a reflection note.
// The note feeds the athlete-facts extractor so the coach picks up training
// responses ("felt great, could've gone heavier", "knee twinged on the long
// run") for future planning. Either field is independently optional — pass
// `note` alone to add a note to an already-completed session, or
// `markComplete: true` to flip status when the user manually completed
// outside the synced data sources.

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    plannedId: string;
    note?: string | null;
    markComplete?: boolean;
  };
  if (!body.plannedId) {
    return NextResponse.json({ error: "plannedId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: planned } = await supabase
    .from("planned_workouts")
    .select("id, plan_id, date, session_type, status")
    .eq("id", body.plannedId)
    .maybeSingle();
  if (!planned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: plan } = await supabase
    .from("training_plans")
    .select("user_id")
    .eq("id", planned.plan_id)
    .maybeSingle();
  if (!plan || plan.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trimmed = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const updates: Record<string, unknown> = {};
  if (trimmed.length > 0) updates.completion_note = trimmed;
  if (body.markComplete) {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
  } else if (planned.status === "completed" && trimmed.length > 0) {
    updates.completed_at = (planned as Record<string, unknown>).completed_at ?? new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  const { error } = await supabase
    .from("planned_workouts")
    .update(updates)
    .eq("id", body.plannedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (trimmed.length > 0) {
    runNoteExtractorJob({
      userId,
      plannedWorkoutId: body.plannedId,
      sessionType: (planned.session_type as string) ?? "session",
      date: (planned.date as string) ?? new Date().toISOString().slice(0, 10),
      noteText: trimmed,
      source: "completion_note",
    });
  }

  return NextResponse.json({ ok: true, changed: true });
}
