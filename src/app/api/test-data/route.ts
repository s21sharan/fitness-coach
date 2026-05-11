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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [integrationsRes, nutritionRes, workoutsRes, cardioRes, recoveryRes] = await Promise.all([
    supabase
      .from("integrations")
      .select("provider, status, last_synced_at, created_at")
      .eq("user_id", userId),
    supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("cardio_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
    supabase
      .from("recovery_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", sinceStr)
      .order("date", { ascending: false }),
  ]);

  return NextResponse.json({
    integrations: integrationsRes.data || [],
    nutrition: nutritionRes.data || [],
    workouts: workoutsRes.data || [],
    cardio: cardioRes.data || [],
    recovery: recoveryRes.data || [],
  });
}
