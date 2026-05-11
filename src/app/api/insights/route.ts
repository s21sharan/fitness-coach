import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sinceStr = ninetyDaysAgo.toISOString().slice(0, 10);

  // Fetch user data in parallel
  const [workoutsRes, cardioRes, recoveryRes] = await Promise.all([
    supabase.from("workout_logs").select("date, name, duration_minutes, exercises")
      .eq("user_id", userId).gte("date", sinceStr).order("date", { ascending: false }),
    supabase.from("cardio_logs").select("date, type, distance, duration, avg_hr, calories, elevation, pace_or_speed")
      .eq("user_id", userId).gte("date", sinceStr).order("date", { ascending: false }),
    supabase.from("recovery_logs").select("date, resting_hr, hrv, sleep_hours, sleep_score, body_battery, stress_level, steps")
      .eq("user_id", userId).gte("date", sinceStr).order("date", { ascending: false }),
  ]);

  const workouts = workoutsRes.data || [];
  const cardio = cardioRes.data || [];
  const recovery = recoveryRes.data || [];

  // Build summary stats for the AI
  const last7Recovery = recovery.slice(0, 7);
  const last30Recovery = recovery.slice(0, 30);
  const avgHrv7 = last7Recovery.filter((r) => r.hrv).length > 0
    ? Math.round(last7Recovery.filter((r) => r.hrv).reduce((s, r) => s + r.hrv!, 0) / last7Recovery.filter((r) => r.hrv).length)
    : null;
  const avgHrv30 = last30Recovery.filter((r) => r.hrv).length > 0
    ? Math.round(last30Recovery.filter((r) => r.hrv).reduce((s, r) => s + r.hrv!, 0) / last30Recovery.filter((r) => r.hrv).length)
    : null;
  const avgSleep7 = last7Recovery.filter((r) => r.sleep_hours).length > 0
    ? Math.round(last7Recovery.filter((r) => r.sleep_hours).reduce((s, r) => s + r.sleep_hours!, 0) / last7Recovery.filter((r) => r.sleep_hours).length * 10) / 10
    : null;
  const avgRhr7 = last7Recovery.filter((r) => r.resting_hr).length > 0
    ? Math.round(last7Recovery.filter((r) => r.resting_hr).reduce((s, r) => s + r.resting_hr!, 0) / last7Recovery.filter((r) => r.resting_hr).length)
    : null;

  // Weekly volumes
  const thisWeekCardio = cardio.filter((c) => {
    const d = new Date(c.date);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 86400000;
  });
  const lastWeekCardio = cardio.filter((c) => {
    const d = new Date(c.date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    return diff >= 7 * 86400000 && diff < 14 * 86400000;
  });
  const thisWeekDist = Math.round(thisWeekCardio.reduce((s, c) => s + (c.distance || 0), 0) * 10) / 10;
  const lastWeekDist = Math.round(lastWeekCardio.reduce((s, c) => s + (c.distance || 0), 0) * 10) / 10;
  const thisWeekTime = Math.round(thisWeekCardio.reduce((s, c) => s + (c.duration || 0), 0) / 60);
  const thisWeekWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return (new Date().getTime() - d.getTime()) < 7 * 86400000;
  }).length;

  // HR zone distribution (last 30 days of cardio)
  const last30Cardio = cardio.slice(0, 30);
  const zoneMinutes = [0, 0, 0, 0, 0];
  for (const c of last30Cardio) {
    if (c.avg_hr && c.duration) {
      const mins = c.duration / 60;
      const zone = c.avg_hr < 120 ? 0 : c.avg_hr < 140 ? 1 : c.avg_hr < 155 ? 2 : c.avg_hr < 170 ? 3 : 4;
      zoneMinutes[zone] += mins;
    }
  }

  // HRV trend direction
  const hrvTrend = avgHrv7 && avgHrv30 ? (avgHrv7 > avgHrv30 ? "improving" : avgHrv7 < avgHrv30 - 3 ? "declining" : "stable") : "unknown";

  const dataSummary = `
User's fitness data summary (last 90 days):

RECOVERY (Garmin):
- 7-day avg HRV: ${avgHrv7 ?? "no data"}, 30-day avg HRV: ${avgHrv30 ?? "no data"}, trend: ${hrvTrend}
- 7-day avg sleep: ${avgSleep7 ?? "no data"}h
- 7-day avg resting HR: ${avgRhr7 ?? "no data"} bpm
- Latest body battery: ${recovery[0]?.body_battery ?? "no data"}
- Latest stress level: ${recovery[0]?.stress_level ?? "no data"}
- Recovery days with data: ${recovery.length}

TRAINING (this week):
- Cardio sessions: ${thisWeekCardio.length}, total distance: ${thisWeekDist} km, total time: ${thisWeekTime} min
- Strength sessions: ${thisWeekWorkouts}
- Last week distance: ${lastWeekDist} km (${thisWeekDist > lastWeekDist ? "increased" : "decreased"} this week)

HR ZONE DISTRIBUTION (last 30 days, minutes):
- Z1 (Recovery <120): ${Math.round(zoneMinutes[0])}min
- Z2 (Aerobic 120-140): ${Math.round(zoneMinutes[1])}min
- Z3 (Tempo 140-155): ${Math.round(zoneMinutes[2])}min
- Z4 (Threshold 155-170): ${Math.round(zoneMinutes[3])}min
- Z5 (Anaerobic 170+): ${Math.round(zoneMinutes[4])}min

TOTALS (90 days):
- Total workouts: ${workouts.length}
- Total cardio sessions: ${cardio.length}
- Total cardio distance: ${Math.round(cardio.reduce((s, c) => s + (c.distance || 0), 0))} km
- Total cardio calories: ${Math.round(cardio.reduce((s, c) => s + (c.calories || 0), 0))} kcal
`.trim();

  const { section } = await req.json() as { section: string };

  const prompts: Record<string, string> = {
    fitness: `Based on this athlete's data, write a 2-3 sentence insight about their FITNESS trend (CTL/chronic training load). Are they building fitness, maintaining, or losing it? Is their training consistent? Be specific to their numbers.\n\n${dataSummary}`,
    recovery: `Based on this athlete's data, write a 2-3 sentence insight about their RECOVERY status. Focus on HRV trends, sleep quality, resting HR, and body battery. Are they recovering well? Any warning signs? Be specific to their numbers.\n\n${dataSummary}`,
    training: `Based on this athlete's data, write a 2-3 sentence insight about their TRAINING LOAD distribution. Look at their HR zone distribution — are they doing enough zone 2? Too much zone 4/5? How does this week compare to last? Be specific.\n\n${dataSummary}`,
    overview: `Based on this athlete's data, write a 3-4 sentence overall summary. Cover fitness trajectory, recovery status, and training balance. Mention one specific thing they're doing well and one thing to watch. Be encouraging but honest.\n\n${dataSummary}`,
  };

  const prompt = prompts[section] || prompts.overview;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
      system: "You are a sports science coach analyzing an athlete's training data. Be concise, specific to their numbers, and actionable. Use plain language, not jargon. Do not use markdown formatting or bullet points — write in flowing sentences.",
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ insight: text });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json({ insight: "Unable to generate insights right now." });
  }
}
