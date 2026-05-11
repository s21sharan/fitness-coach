import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekStart } = await req.json() as { weekStart: string };

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

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { error } = await supabase
    .from("planned_workouts")
    .update({ approved: true })
    .eq("plan_id", plan.id)
    .gte("date", weekStart)
    .lte("date", weekEnd.toISOString().slice(0, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "approved" });
}
