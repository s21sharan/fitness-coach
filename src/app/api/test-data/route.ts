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

  const sinceStr = addCalendarDaysYmd(localToday, -90);

  const plannedFromStr = addCalendarDaysYmd(localToday, -365);
  const plannedToStr = addCalendarDaysYmd(localToday, 365);

  const [integrationsRes, workoutsRes, cardioRes, recoveryRes, planRes] = await Promise.all([
    supabase
      .from("integrations")
      .select("provider, status, last_synced_at, created_at")
      .eq("user_id", userId),
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("cardio_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("recovery_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("training_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const planId = planRes.data?.[0]?.id;
  let plannedRows: unknown[] = [];
  if (planId) {
    const { data: pw, error: pwErr } = await supabase
      .from("planned_workouts")
      .select("id, date, day_of_week, session_type, ai_notes, targets, approved, status")
      .eq("plan_id", planId)
      .gte("date", plannedFromStr)
      .lte("date", plannedToStr)
      .order("date");
    if (pwErr) console.error("test-data planned_workouts:", pwErr);
    plannedRows = pw || [];
  }

  return NextResponse.json({
    integrations: integrationsRes.data || [],
    workouts: workoutsRes.data || [],
    cardio: cardioRes.data || [],
    recovery: recoveryRes.data || [],
    planned: plannedRows,
  });
}
