import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { HrZoneConfig, PowerZoneConfig } from "@/lib/training/zones";
import { validateZoneBoundaries } from "@/lib/training/zone-calculator";

type ZoneScope = "global" | "run" | "bike";

interface SportSpecific {
  hr_zones?: HrZoneConfig | null;
  power_zones?: PowerZoneConfig | null;
  [key: string]: unknown;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data: sportsData, error } = await supabase
    .from("athlete_sports")
    .select("sport, sport_specific")
    .eq("user_id", userId)
    .in("sport", ["global", "run", "bike"]);

  if (error) {
    console.error("Error fetching zone settings:", error);
    return NextResponse.json({ error: "Failed to fetch zones" }, { status: 500 });
  }

  const zones: Record<ZoneScope, { hr?: HrZoneConfig | null; power?: PowerZoneConfig | null }> = {
    global: {},
    run: {},
    bike: {},
  };

  for (const row of sportsData || []) {
    const sport = row.sport as ZoneScope;
    const specific = row.sport_specific as SportSpecific | null;
    if (specific && (sport === "global" || sport === "run" || sport === "bike")) {
      zones[sport] = {
        hr: specific.hr_zones ?? null,
        power: specific.power_zones ?? null,
      };
    }
  }

  return NextResponse.json({ zones });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { scope: ZoneScope; hr?: HrZoneConfig | null; power?: PowerZoneConfig | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scope, hr, power } = body;
  if (!scope || !["global", "run", "bike"].includes(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (hr && hr.boundaries) {
    if (!validateZoneBoundaries(hr.boundaries, 5)) {
      return NextResponse.json({ error: "Invalid HR zone boundaries" }, { status: 400 });
    }
  }

  if (power && power.boundaries) {
    if (!validateZoneBoundaries(power.boundaries, 7)) {
      return NextResponse.json({ error: "Invalid power zone boundaries" }, { status: 400 });
    }
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("athlete_sports")
    .select("sport_specific")
    .eq("user_id", userId)
    .eq("sport", scope)
    .maybeSingle();

  const currentSpecific = (existing?.sport_specific as SportSpecific) ?? {};
  const updatedSpecific: SportSpecific = { ...currentSpecific };

  if (hr !== undefined) {
    updatedSpecific.hr_zones = hr;
  }
  if (power !== undefined) {
    updatedSpecific.power_zones = power;
  }

  const { error } = await supabase
    .from("athlete_sports")
    .upsert(
      {
        user_id: userId,
        sport: scope,
        sport_specific: updatedSpecific,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,sport" },
    );

  if (error) {
    console.error("Error saving zone settings:", error);
    return NextResponse.json({ error: "Failed to save zones" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
