import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("integrations")
    .select("provider, status, last_synced_at, created_at")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });

  const providers = ["macrofactor", "hevy", "strava", "garmin"];
  const statusMap = providers.map((provider) => {
    const integration = data?.find((i) => i.provider === provider);
    return {
      provider,
      connected: !!integration,
      status: integration?.status || "disconnected",
      lastSyncedAt: integration?.last_synced_at || null,
      connectedAt: integration?.created_at || null,
    };
  });

  return NextResponse.json({ integrations: statusMap });
}
