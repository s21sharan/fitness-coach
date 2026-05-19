import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDaysYmd, formatCalendarDateLocal, isValidYmd } from "@/lib/dates/local-calendar";
import type { HrZoneConfig, PowerZoneConfig, UserPowerZones } from "@/lib/training/zones";
import type { ZoneBoundary } from "@/lib/training/calendar-data";
import { getDefaultPowerZones } from "@/lib/training/zone-calculator";

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

  const [integrationsRes, workoutsRes, cardioRes, recoveryRes, planRes, athleteSportsRes] = await Promise.all([
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
    supabase
      .from("athlete_sports")
      .select("sport, sport_specific")
      .eq("user_id", userId)
      .in("sport", ["global", "run", "bike"]),
  ]);

  const planId = planRes.data?.[0]?.id;
  let plannedRows: Array<{ id: string }> = [];
  let activeBlock: unknown = null;
  const linkedActuals: Record<string, { table: "workout_logs" | "cardio_logs"; id: string }> = {};
  if (planId) {
    const [pwRes, blockRes] = await Promise.all([
      supabase
        .from("planned_workouts")
        .select("id, date, day_of_week, session_type, ai_notes, targets, approved, status, skip_reason, completion_note")
        .eq("plan_id", planId)
        .gte("date", plannedFromStr)
        .lte("date", plannedToStr)
        .order("date"),
      supabase
        .from("training_blocks")
        .select("*")
        .eq("plan_id", planId)
        .eq("status", "active")
        .order("block_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (pwRes.error) console.error("test-data planned_workouts:", pwRes.error);
    plannedRows = (pwRes.data as Array<{ id: string }>) || [];
    activeBlock = blockRes.data ?? null;

    // Resolve which actual log each completed planned slot is linked to.
    // Single roundtrip per side — much cheaper than a join.
    const plannedIds = plannedRows.map((p) => p.id);
    if (plannedIds.length > 0) {
      const [linkedWorkouts, linkedCardio] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("id, planned_workout_id")
          .eq("user_id", userId)
          .in("planned_workout_id", plannedIds),
        supabase
          .from("cardio_logs")
          .select("id, planned_workout_id")
          .eq("user_id", userId)
          .in("planned_workout_id", plannedIds),
      ]);
      for (const row of (linkedWorkouts.data ?? []) as Array<{
        id: string;
        planned_workout_id: string;
      }>) {
        linkedActuals[row.planned_workout_id] = { table: "workout_logs", id: row.id };
      }
      for (const row of (linkedCardio.data ?? []) as Array<{
        id: string;
        planned_workout_id: string;
      }>) {
        linkedActuals[row.planned_workout_id] = { table: "cardio_logs", id: row.id };
      }
    }
  }

  // Parse custom zones from athlete_sports
  const customZones = parseCustomZones(athleteSportsRes.data);

  // Derive the user's canonical HR zones with priority:
  // 1. Custom zones from settings
  // 2. Garmin zones from most recent activity
  // 3. Legacy fallback (handled client-side)
  const hrZones = deriveUserHrZonesWithCustom(cardioRes.data, customZones.hr);
  const powerZones = derivePowerZones(customZones.power);
  const dedupedCardio = deduplicateCardio(cardioRes.data || []);

  return NextResponse.json({
    integrations: integrationsRes.data || [],
    workouts: workoutsRes.data || [],
    cardio: dedupedCardio,
    recovery: recoveryRes.data || [],
    planned: plannedRows,
    linkedActuals,
    hrZones,
    powerZones,
    activeBlock,
  });
}

// Safety-net dedup: if the backend reconciler missed a Strava/Garmin pair
// (e.g. activities synced out of order, type mismatch, missing start_time),
// collapse them here so the calendar doesn't show duplicate cards.
const SOURCE_PRIORITY: Record<string, number> = { merged: 3, strava: 2, garmin: 1 };

interface CardioRow {
  id?: string;
  date?: string;
  type?: string;
  duration?: number;
  distance?: number;
  source?: string;
  start_time?: string | null;
  [key: string]: unknown;
}

function deduplicateCardio(rows: CardioRow[]): CardioRow[] {
  // Group by date + type
  const groups = new Map<string, CardioRow[]>();
  for (const row of rows) {
    const key = `${row.date ?? ""}|${row.type ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const result: CardioRow[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) {
      result.push(...group);
      continue;
    }

    // Within each date+type group, find pairs that look like the same activity
    const kept = new Set<number>();
    const suppressed = new Set<number>();

    for (let i = 0; i < group.length; i++) {
      if (suppressed.has(i)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (suppressed.has(j)) continue;
        if (isSameActivity(group[i], group[j])) {
          // Keep the higher-priority source
          const priI = SOURCE_PRIORITY[group[i].source ?? ""] ?? 0;
          const priJ = SOURCE_PRIORITY[group[j].source ?? ""] ?? 0;
          if (priJ > priI) {
            suppressed.add(i);
            kept.add(j);
          } else {
            suppressed.add(j);
            kept.add(i);
          }
        }
      }
      kept.add(i);
    }

    for (let i = 0; i < group.length; i++) {
      if (!suppressed.has(i)) result.push(group[i]);
    }
  }

  return result;
}

function isSameActivity(a: CardioRow, b: CardioRow): boolean {
  // Check start times if both exist (within 15 min)
  if (a.start_time && b.start_time) {
    const delta = Math.abs(new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    if (delta > 15 * 60 * 1000) return false;
  }

  // Check duration similarity (within 25%)
  const durA = a.duration ?? 0;
  const durB = b.duration ?? 0;
  if (durA > 0 && durB > 0) {
    const maxDur = Math.max(durA, durB);
    const diff = Math.abs(durA - durB);
    if (diff / maxDur > 0.25 && diff > 5 * 60) return false;
  }

  // Check distance similarity (within 10%)
  const distA = a.distance ?? 0;
  const distB = b.distance ?? 0;
  if (distA > 0 && distB > 0) {
    const maxDist = Math.max(distA, distB);
    if (Math.abs(distA - distB) / maxDist > 0.1) return false;
  }

  return true;
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

interface AthleteSportRow {
  sport: string;
  sport_specific: {
    hr_zones?: HrZoneConfig | null;
    power_zones?: PowerZoneConfig | null;
  } | null;
}

interface CustomZonesResult {
  hr: { global?: HrZoneConfig | null; run?: HrZoneConfig | null; bike?: HrZoneConfig | null };
  power: { global?: PowerZoneConfig | null; run?: PowerZoneConfig | null; bike?: PowerZoneConfig | null };
}

function parseCustomZones(rows: AthleteSportRow[] | null): CustomZonesResult {
  const result: CustomZonesResult = { hr: {}, power: {} };
  if (!rows) return result;
  for (const row of rows) {
    const sport = row.sport as "global" | "run" | "bike";
    if (sport !== "global" && sport !== "run" && sport !== "bike") continue;
    const specific = row.sport_specific;
    if (specific?.hr_zones) {
      result.hr[sport] = specific.hr_zones;
    }
    if (specific?.power_zones) {
      result.power[sport] = specific.power_zones;
    }
  }
  return result;
}

function deriveUserHrZonesWithCustom(
  cardio: CardioRowSlim[] | null,
  customHr: { global?: HrZoneConfig | null; run?: HrZoneConfig | null; bike?: HrZoneConfig | null },
): { source: "custom" | "garmin"; mode?: import("@/lib/training/zones").HrZoneMode; boundaries: ZoneBoundary[]; syncedAt: string | null } | null {
  // Priority 1: Custom zones (global for now, per-sport can be passed to specific components)
  const custom = customHr.global;
  if (custom && custom.boundaries && custom.boundaries.length === 5) {
    return {
      source: "custom",
      mode: custom.mode,
      boundaries: custom.boundaries,
      syncedAt: custom.updated_at ?? null,
    };
  }

  // Priority 2: Garmin zones from cardio logs
  return deriveUserHrZonesFromGarmin(cardio);
}

function deriveUserHrZonesFromGarmin(
  cardio: CardioRowSlim[] | null,
): { source: "garmin"; boundaries: ZoneBoundary[]; syncedAt: string | null } | null {
  if (!cardio || cardio.length === 0) return null;
  for (const row of cardio) {
    const raw = row.hr_zones;
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const parsed: ZoneBoundary[] = [];
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

function derivePowerZones(
  customPower: { global?: PowerZoneConfig | null; run?: PowerZoneConfig | null; bike?: PowerZoneConfig | null },
): UserPowerZones | null {
  const custom = customPower.global ?? customPower.bike;
  if (custom && custom.boundaries && custom.boundaries.length === 7) {
    return {
      source: "custom",
      mode: custom.mode,
      ftp: custom.ftp,
      boundaries: custom.boundaries,
      updatedAt: custom.updated_at ?? null,
    };
  }
  // No custom power zones - return legacy fallback
  return {
    source: "legacy",
    boundaries: getDefaultPowerZones(),
    updatedAt: null,
  };
}
