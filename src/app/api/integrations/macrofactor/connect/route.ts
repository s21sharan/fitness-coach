import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const firebaseApiKey = process.env.MACROFACTOR_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    return NextResponse.json({ error: "MacroFactor not configured" }, { status: 500 });
  }

  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ios-Bundle-Identifier": "com.sbs.diet" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );

  if (!authRes.ok) {
    return NextResponse.json({ error: "Invalid MacroFactor credentials" }, { status: 401 });
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const encryptedCreds = {
    email: encrypt(email, encryptionKey),
    password: encrypt(password, encryptionKey),
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase.from("integrations").upsert(
    {
      user_id: userId,
      provider: "macrofactor",
      credentials: encryptedCreds,
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
        provider: "macrofactor",
        userId,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ status: "connected" });
}
