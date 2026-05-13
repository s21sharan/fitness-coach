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
      .eq("is_suppressed", false)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("cardio_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("is_suppressed", false)
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

  // Derive the user's canonical HR zones from the most recent Garmin activity
  // that carries device-supplied zone boundaries. Garmin uses one set of
  // user-level zones (per sport optionally), and stores them per-activity in
  // `cardio_logs.hr_zones`. The most recent one reflects the user's current
  // settings. If no Garmin row has hr_zones, return null and the client falls
  // back to legacy hardcoded thresholds.
  const hrZones = deriveUserHrZones(cardioRes.data);

  return NextResponse.json({
    integrations: integrationsRes.data || [],
    workouts: workoutsRes.data || [],
    cardio: cardioRes.data || [],
    recovery: recoveryRes.data || [],
    planned: plannedRows,
    hrZones,
  });
}

interface GarminZoneRow {
  zone: number | null;
  low: number | null;
  high: number | null;
  minutes?: number | null;
}

interface CardioRowSlim {
  source?: string | null;
  hr_zones?: unknown;
  synced_at?: string | null;
  date?: string | null;
}

function deriveUserHrZones(
  cardio: CardioRowSlim[] | null,
): { source: "garmin"; boundaries: Array<{ zone: number; low: number; high: number }>; syncedAt: string | null } | null {
  if (!cardio || cardio.length === 0) return null;
  // cardioRes is ordered by date desc; walk it and pick the first row with a
  // well-formed 5-entry hr_zones payload. Garmin is the only writer of
  // `hr_zones` — rows can have source='garmin' (Garmin-only) or 'merged'
  // (Strava activity enriched by matching Garmin data); both carry the
  // authoritative user zones.
  for (const row of cardio) {
    const raw = row.hr_zones;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const parsed: Array<{ zone: number; low: number; high: number }> = [];
    for (const z of raw as GarminZoneRow[]) {
      if (!z || typeof z !== "object") continue;
      const zone = typeof z.zone === "number" ? z.zone : null;
      const low = typeof z.low === "number" ? z.low : null;
      const high = typeof z.high === "number" ? z.high : null;
      if (zone === null || low === null || high === null) continue;
      parsed.push({ zone, low, high });
    }
    if (parsed.length !== 5) continue;
    parsed.sort((a, b) => a.zone - b.zone);
    return {
      source: "garmin",
      boundaries: parsed,
      syncedAt: row.synced_at ?? row.date ?? null,
    };
  }
  return null;
}
