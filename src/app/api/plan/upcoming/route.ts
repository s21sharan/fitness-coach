import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDaysYmd, formatCalendarDateLocal, isValidYmd } from "@/lib/dates/local-calendar";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const rawToday = url.searchParams.get("localToday");
  const localToday =
    rawToday && isValidYmd(rawToday) ? rawToday : formatCalendarDateLocal(new Date());

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

  const sinceStr = addCalendarDaysYmd(localToday, -30);
  const endStr = addCalendarDaysYmd(localToday, 120);

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, date, day_of_week, session_type, ai_notes, targets, approved, status")
    .eq("plan_id", plan.id)
    .gte("date", sinceStr)
    .lte("date", endStr)
    .order("date");

  return NextResponse.json({ workouts: workouts || [] });
}
