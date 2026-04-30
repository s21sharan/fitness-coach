import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_PROVIDERS = ["macrofactor", "hevy", "strava", "garmin"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const backendUrl = process.env.RAILWAY_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const res = await fetch(`${backendUrl}/sync/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.RAILWAY_API_SECRET!,
    },
    body: JSON.stringify({ provider, userId }),
  });

  if (!res.ok) return NextResponse.json({ error: "Sync trigger failed" }, { status: 500 });

  return NextResponse.json({ status: "sync_triggered" });
}
