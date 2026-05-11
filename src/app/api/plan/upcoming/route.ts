import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!plan) return NextResponse.json({ workouts: [] });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);
  const endStr = in14Days.toISOString().slice(0, 10);

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, date, day_of_week, session_type, ai_notes, targets, approved, status")
    .eq("plan_id", plan.id)
    .gte("date", sinceStr)
    .lte("date", endStr)
    .order("date");

  return NextResponse.json({ workouts: workouts || [] });
}
