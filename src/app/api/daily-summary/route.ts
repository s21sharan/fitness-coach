// src/app/api/daily-summary/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { buildTrainingHistory } from "@/lib/training/training-history";
import { trackTokenUsage } from "@/lib/usage/track";
import { buildDailySummaryPrompt, DAILY_SUMMARY_SYSTEM_PROMPT } from "@/lib/training/daily-summary-prompt";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const date = (body.date as string) || new Date().toISOString().slice(0, 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch today's data in parallel
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const since14 = fourteenDaysAgo.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since7 = sevenDaysAgo.toISOString().slice(0, 10);

  const [recoveryRes, workoutsTodayRes, cardioTodayRes, workoutsHistRes, plannedRes, recovery7Res, eventsRes] = await Promise.all([
    supabase.from("recovery_logs").select("sleep_hours, sleep_score, hrv, resting_hr, body_battery, stress_level, steps").eq("user_id", userId).eq("date", date).single(),
    supabase.from("workout_logs").select("name, duration_minutes, exercises").eq("user_id", userId).eq("is_suppressed", false).eq("date", date),
    supabase.from("cardio_logs").select("type, distance, duration, avg_hr, pace_or_speed, calories, elevation").eq("user_id", userId).eq("is_suppressed", false).eq("date", date),
    supabase.from("workout_logs").select("date, exercises").eq("user_id", userId).eq("is_suppressed", false).gte("date", since14),
    supabase.from("planned_workouts").select("session_type").eq("date", date).limit(1),
    supabase.from("recovery_logs").select("hrv").eq("user_id", userId).gte("date", since7),
    supabase.from("athlete_events").select("name, event_date, priority, goal_time").eq("user_id", userId).gte("event_date", date).order("event_date", { ascending: true }).limit(5),
  ]);

  const recovery = recoveryRes.data;
  const workoutsToday = workoutsTodayRes.data || [];
  const cardioToday = cardioTodayRes.data || [];
  const workoutsHist = workoutsHistRes.data || [];
  const plannedToday = (plannedRes.data?.[0] as { session_type?: string } | undefined)?.session_type || null;

  const upcomingEvents = (eventsRes.data || []).map((ev: { name: string; event_date: string; priority: string | null; goal_time: string | null }) => {
    const target = new Date(ev.event_date + "T00:00:00");
    const today = new Date(date + "T00:00:00");
    const days_away = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { ...ev, days_away };
  });

  // No data at all — return empty
  if (!recovery && workoutsToday.length === 0 && cardioToday.length === 0) {
    return NextResponse.json({ summary: null, generated_at: null, cached: false });
  }

  // Compute 7-day avg HRV
  const hrvValues = (recovery7Res.data || []).map((r: { hrv: number | null }) => r.hrv).filter((v): v is number => v != null);
  const avgHrv7 = hrvValues.length > 0 ? Math.round(hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length) : null;

  // Build training history
  const trainingHistory = buildTrainingHistory(
    workoutsHist.map((w: { date: string; exercises: unknown }) => ({
      date: w.date,
      exercises: Array.isArray(w.exercises) ? w.exercises : [],
    }))
  );

  // Hash all data for cache invalidation
  const dataForHash = JSON.stringify({ recovery, workoutsToday, cardioToday, trainingHistory, upcomingEvents });
  const dataHash = createHash("md5").update(dataForHash).digest("hex");

  // Check cache
  const { data: cached } = await supabase
    .from("daily_summaries")
    .select("summary, generated_at, data_hash")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (cached && cached.data_hash === dataHash) {
    return NextResponse.json({ summary: cached.summary, generated_at: cached.generated_at, cached: true });
  }

  // Build prompt
  const prompt = buildDailySummaryPrompt({
    date,
    recovery,
    avgHrv7,
    workoutsToday: workoutsToday.map((w: { name: string; duration_minutes: number; exercises: unknown }) => ({
      name: w.name || "Workout",
      duration_minutes: w.duration_minutes || 0,
      exerciseCount: Array.isArray(w.exercises) ? w.exercises.length : 0,
    })),
    cardioToday: cardioToday.map((c: { type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null; calories: number | null; elevation: number | null }) => ({
      type: c.type || "other",
      distance: c.distance || 0,
      duration: c.duration || 0,
      avg_hr: c.avg_hr,
      pace_or_speed: c.pace_or_speed,
      calories: c.calories,
      elevation: c.elevation,
    })),
    plannedToday,
    trainingHistory,
    upcomingEvents,
  });

  // Generate via Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: DAILY_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = message.content[0].type === "text" ? message.content[0].text : "";
    trackTokenUsage({
      userId,
      source: "daily_summary",
      model: "claude-sonnet-4-6",
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });
    const now = new Date().toISOString();

    // Upsert cache
    await supabase.from("daily_summaries").upsert(
      { user_id: userId, date, summary, data_hash: dataHash, generated_at: now },
      { onConflict: "user_id,date" }
    );

    return NextResponse.json({ summary, generated_at: now, cached: false });
  } catch (error) {
    console.error("Daily summary generation error:", error);
    return NextResponse.json({ summary: null, generated_at: null, cached: false });
  }
}
