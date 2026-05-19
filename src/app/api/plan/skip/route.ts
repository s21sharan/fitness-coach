import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runNoteExtractorJob } from "@/lib/chat/extractor-job";

// User-initiated skip: mark the planned slot as deliberately skipped and
// optionally capture a reason for the coach to read later. If the slot was
// already auto-matched to an actual log, treat the skip as an override and
// unlink the actual as part of the same operation.

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plannedId, reason } = (await req.json()) as {
    plannedId: string;
    reason?: string | null;
  };
  if (!plannedId) {
    return NextResponse.json({ error: "plannedId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: planned } = await supabase
    .from("planned_workouts")
    .select("id, plan_id, date, session_type")
    .eq("id", plannedId)
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

  const now = new Date().toISOString();
  const { error: cardioErr } = await supabase
    .from("cardio_logs")
    .update({ planned_workout_id: null, unmatched_at: now })
    .eq("planned_workout_id", plannedId);
  if (cardioErr) return NextResponse.json({ error: cardioErr.message }, { status: 500 });
  const { error: workoutErr } = await supabase
    .from("workout_logs")
    .update({ planned_workout_id: null, unmatched_at: now })
    .eq("planned_workout_id", plannedId);
  if (workoutErr) return NextResponse.json({ error: workoutErr.message }, { status: 500 });

  const trimmed = typeof reason === "string" ? reason.trim() : "";
  const { error: plannedErr } = await supabase
    .from("planned_workouts")
    .update({
      status: "skipped",
      skip_reason: trimmed.length > 0 ? trimmed.slice(0, 2000) : null,
      skipped_at: now,
    })
    .eq("id", plannedId);
  if (plannedErr) return NextResponse.json({ error: plannedErr.message }, { status: 500 });

  if (trimmed.length > 0) {
    runNoteExtractorJob({
      userId,
      plannedWorkoutId: plannedId,
      sessionType: (planned.session_type as string) ?? "session",
      date: (planned.date as string) ?? new Date().toISOString().slice(0, 10),
      noteText: trimmed,
      source: "skip_note",
    });
  }

  return NextResponse.json({ ok: true });
}
