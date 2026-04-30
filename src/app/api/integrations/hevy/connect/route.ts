import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey } = await request.json();
  if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 });

  const testRes = await fetch("https://api.hevyapp.com/v1/workouts?page=1&pageSize=1", {
    headers: { "api-key": apiKey },
  });

  if (!testRes.ok) {
    return NextResponse.json({ error: "Invalid Hevy API key" }, { status: 401 });
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "hevy",
      access_token: encrypt(apiKey, encryptionKey),
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });

  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.RAILWAY_API_SECRET! },
      body: JSON.stringify({
        provider: "hevy",
        userId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "connected" });
}
