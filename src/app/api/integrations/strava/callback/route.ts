import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=denied", request.url),
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;

  const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=token_exchange", request.url),
    );
  }

  const tokenData = await tokenRes.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: state,
        provider: "strava",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        provider_user_id: String(tokenData.athlete?.id),
        credentials: { expires_at: tokenData.expires_at },
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

  if (dbError) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?strava=error&reason=db", request.url),
    );
  }

  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RAILWAY_API_SECRET!,
      },
      body: JSON.stringify({
        provider: "strava",
        userId: state,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings?strava=success", request.url),
  );
}
