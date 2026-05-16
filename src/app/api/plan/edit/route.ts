import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertDateNotPast } from "@/lib/training/date-guards";

type EditAction =
  | { action: "create"; date: string; session_type: string; ai_notes?: string; targets?: Record<string, unknown> }
  | { action: "update"; workout_id: string; session_type?: string; ai_notes?: string; targets?: Record<string, unknown> }
  | { action: "delete"; workout_id: string };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { edits } = await req.json() as { edits: EditAction[] };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) return NextResponse.json({ error: "No active plan" }, { status: 404 });

  // Pre-flight: reject the whole batch if any edit targets a past date.
  const rejected: Array<{ index: number; reason: string }> = [];
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (edit.action === "create") {
      const guard = assertDateNotPast(edit.date);
      if (!guard.ok) rejected.push({ index: i, reason: guard.error });
    } else if (edit.action === "update") {
      const { data: row } = await supabase
        .from("planned_workouts")
        .select("date")
        .eq("id", edit.workout_id)
        .eq("plan_id", plan.id)
        .maybeSingle();
      if (!row) {
        rejected.push({ index: i, reason: `Workout ${edit.workout_id} not found.` });
      } else {
        const guard = assertDateNotPast(row.date as string);
        if (!guard.ok) rejected.push({ index: i, reason: guard.error });
      }
    } else if (edit.action === "delete") {
      const { data: row } = await supabase
        .from("planned_workouts")
        .select("date")
        .eq("id", edit.workout_id)
        .eq("plan_id", plan.id)
        .maybeSingle();
      if (row) {
        const guard = assertDateNotPast(row.date as string);
        if (!guard.ok) rejected.push({ index: i, reason: guard.error });
      }
    }
  }
  if (rejected.length > 0) {
    return NextResponse.json({ error: "Past dates are read-only.", rejected }, { status: 400 });
  }

  const results = [];

  for (const edit of edits) {
    if (edit.action === "create") {
      const dayOfWeek = new Date(edit.date + "T00:00:00").getDay();
      const { error } = await supabase.from("planned_workouts").insert({
        plan_id: plan.id,
        date: edit.date,
        day_of_week: dayOfWeek === 0 ? 6 : dayOfWeek - 1,
        session_type: edit.session_type,
        ai_notes: edit.ai_notes || null,
        targets: edit.targets || null,
        approved: true,
      });
      results.push({ action: "create", date: edit.date, success: !error });
    } else if (edit.action === "update") {
      const updates: Record<string, unknown> = {};
      if (edit.session_type) updates.session_type = edit.session_type;
      if (edit.ai_notes !== undefined) updates.ai_notes = edit.ai_notes;
      if (edit.targets !== undefined) updates.targets = edit.targets;
      const { error } = await supabase.from("planned_workouts").update(updates).eq("id", edit.workout_id).eq("plan_id", plan.id);
      results.push({ action: "update", id: edit.workout_id, success: !error });
    } else if (edit.action === "delete") {
      const { error } = await supabase.from("planned_workouts").delete().eq("id", edit.workout_id).eq("plan_id", plan.id);
      results.push({ action: "delete", id: edit.workout_id, success: !error });
    }
  }

  return NextResponse.json({ results });
}
