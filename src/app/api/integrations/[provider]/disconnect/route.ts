import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_PROVIDERS = ["hevy", "strava", "garmin"];

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });

  // Removing a provider may un-shadow rows from a lower-priority provider
  // (e.g. disconnect Hevy → Strava strength activities re-surface). Fire and
  // forget — reconciliation is idempotent and the integration is already gone.
  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (backendUrl) {
    fetch(`${backendUrl}/sync/reconcile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.RAILWAY_API_SECRET!,
      },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "disconnected" });
}
