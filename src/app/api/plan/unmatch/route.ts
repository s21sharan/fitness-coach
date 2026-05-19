import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// User-initiated unmatch: an auto-matched actual log isn't actually the
// session the user intended (e.g. matcher linked a casual pool dip to a
// planned interval swim). Clear the reverse FK, set unmatched_at on the
// actual so the reconciler won't re-link it, and revert the planned slot
// back to scheduled. The skip_reason field is intentionally untouched —
// unmatching is not unskipping.

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plannedId } = (await req.json()) as { plannedId: string };
  if (!plannedId) {
    return NextResponse.json({ error: "plannedId required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: planned } = await supabase
    .from("planned_workouts")
    .select("id, plan_id")
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
  // Hit both tables — at most one row matches. Updates are no-ops on the
  // table that doesn't have a link.
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

  const { error: plannedErr } = await supabase
    .from("planned_workouts")
    .update({ status: "scheduled" })
    .eq("id", plannedId);
  if (plannedErr) return NextResponse.json({ error: plannedErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
