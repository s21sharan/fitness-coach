import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidIanaTimeZone } from "@/lib/dates/local-calendar";

const FAR_PAST_ISO = "1970-01-01T00:00:00.000Z";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";
  if (!timezone || !isValidIanaTimeZone(timezone)) {
    return NextResponse.json({ error: "Valid IANA timezone required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: tzErr } = await supabase
    .from("user_profiles")
    .upsert({ user_id: userId, timezone }, { onConflict: "user_id" });
  if (tzErr) {
    return NextResponse.json({ error: "Failed to persist timezone" }, { status: 500 });
  }

  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  const apiKey = process.env.RAILWAY_API_SECRET;
  if (!backendUrl || !apiKey) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  // Only trigger re-syncs for providers the user has actually connected.
  const { data: integrationsRows } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", userId);
  const connected = new Set((integrationsRows || []).map((r) => r.provider));

  // Hevy: trigger a full re-fetch (no `since` → syncHevyForUser uses getWorkouts()).
  // Strava: use backfill with a far-past `since` to pull every activity.
  const headers = { "Content-Type": "application/json", "X-API-Key": apiKey };

  async function callBackend(path: string, payload: Record<string, unknown>) {
    try {
      const r = await fetch(`${backendUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await r.text().catch(() => "");
      return { ok: r.ok, status: r.status, body: text.slice(0, 500) };
    } catch (err) {
      return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
    }
  }

  const results: Record<string, { ok: boolean; status: number; body: string } | { skipped: true }> = {};
  const calls: Promise<void>[] = [];

  if (connected.has("hevy")) {
    calls.push(
      callBackend("/sync/trigger", { provider: "hevy", userId }).then((r) => {
        results.hevy = r;
      }),
    );
  } else {
    results.hevy = { skipped: true };
  }

  if (connected.has("strava")) {
    calls.push(
      callBackend("/sync/backfill", { provider: "strava", userId, since: FAR_PAST_ISO }).then((r) => {
        results.strava = r;
      }),
    );
  } else {
    results.strava = { skipped: true };
  }

  await Promise.all(calls);

  const allOk = Object.values(results).every((r) => "skipped" in r || r.ok);
  return NextResponse.json(
    { status: allOk ? "fix_triggered" : "partial", timezone, results },
    { status: allOk ? 200 : 207 },
  );
}
