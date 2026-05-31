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

  // Get current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Fetch all usage rows for this month
  const { data: rows, error } = await supabase
    .from("token_usage")
    .select("source, model, input_tokens, output_tokens, created_at")
    .eq("user_id", userId)
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Usage fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }

  const usage = rows || [];

  // Aggregate by source
  const bySource: Record<string, { input: number; output: number; count: number }> = {};
  let totalInput = 0;
  let totalOutput = 0;

  for (const row of usage) {
    const src = row.source;
    if (!bySource[src]) bySource[src] = { input: 0, output: 0, count: 0 };
    bySource[src].input += row.input_tokens;
    bySource[src].output += row.output_tokens;
    bySource[src].count += 1;
    totalInput += row.input_tokens;
    totalOutput += row.output_tokens;
  }

  // Daily totals for the chart (last 30 days)
  const dailyMap: Record<string, { input: number; output: number }> = {};
  for (const row of usage) {
    const day = row.created_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { input: 0, output: 0 };
    dailyMap[day].input += row.input_tokens;
    dailyMap[day].output += row.output_tokens;
  }

  const daily = Object.entries(dailyMap)
    .map(([date, tokens]) => ({ date, ...tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    totalInput,
    totalOutput,
    totalTokens: totalInput + totalOutput,
    requestCount: usage.length,
    bySource,
    daily,
  });
}
