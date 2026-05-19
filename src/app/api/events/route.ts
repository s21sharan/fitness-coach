import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabase();
  const url = new URL(req.url);
  const includePast = url.searchParams.get("include_past") === "true";

  let query = supabase
    .from("athlete_events")
    .select("*")
    .eq("user_id", userId);

  if (!includePast) {
    const today = new Date().toISOString().split("T")[0];
    query = (query as ReturnType<typeof query.gte>).gte("event_date", today) as typeof query;
  }

  const { data, error } = await (query as ReturnType<typeof query.order>).order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const { name, sport_type, distance, event_date, priority, goal_type, goal_time, course_notes, travel } = body;

  if (!name || !event_date) {
    return NextResponse.json({ error: "name and event_date are required" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("athlete_events")
    .insert({
      user_id: userId,
      name,
      sport_type: sport_type ?? null,
      distance: distance ?? null,
      event_date,
      priority: priority ?? null,
      goal_type: goal_type ?? null,
      goal_time: goal_time ?? null,
      course_notes: course_notes ?? null,
      travel: travel ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: data }, { status: 201 });
}
