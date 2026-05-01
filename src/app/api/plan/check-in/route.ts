import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: checkIn } = await supabase
    .from("weekly_check_ins")
    .select("*")
    .eq("user_id", userId)
    .is("user_approved", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ checkIn: checkIn || null });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checkInId, approved } = await request.json() as { checkInId: string; approved: boolean };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: updateError } = await supabase
    .from("weekly_check_ins")
    .update({ user_approved: approved })
    .eq("id", checkInId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (approved) {
    const { data: checkIn } = await supabase
      .from("weekly_check_ins")
      .select("plan_id, next_week_layout, week_start_date")
      .eq("id", checkInId)
      .single();

    if (checkIn?.next_week_layout) {
      const nextMonday = new Date(checkIn.week_start_date);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);

      await supabase
        .from("planned_workouts")
        .update({ approved: true })
        .eq("plan_id", checkIn.plan_id)
        .gte("date", nextMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10));
    }
  } else {
    const { data: checkIn } = await supabase
      .from("weekly_check_ins")
      .select("plan_id, week_start_date")
      .eq("id", checkInId)
      .single();

    if (checkIn) {
      const nextMonday = new Date(checkIn.week_start_date);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);

      await supabase
        .from("planned_workouts")
        .delete()
        .eq("plan_id", checkIn.plan_id)
        .eq("approved", false)
        .gte("date", nextMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10));
    }
  }

  return NextResponse.json({ status: approved ? "approved" : "rejected" });
}
