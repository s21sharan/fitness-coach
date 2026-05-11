import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
