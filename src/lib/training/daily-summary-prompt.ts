import type { TrainingHistory } from "./training-history";

interface RecoveryData {
  sleep_hours: number | null;
  sleep_score: number | null;
  hrv: number | null;
  resting_hr: number | null;
  body_battery: number | null;
  stress_level: number | null;
  steps: number | null;
}

interface CardioData {
  type: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
}

interface WorkoutData {
  name: string;
  duration_minutes: number;
  exerciseCount: number;
}

export interface DailySummaryPromptInput {
  date: string;
  recovery: RecoveryData | null;
  avgHrv7: number | null;
  workoutsToday: WorkoutData[];
  cardioToday: CardioData[];
  plannedToday: string | null;
  trainingHistory: TrainingHistory;
  upcomingEvents?: { name: string; event_date: string; priority: string | null; goal_time: string | null; days_away: number }[];
}

export const DAILY_SUMMARY_SYSTEM_PROMPT = `You are a concise sports coach writing a daily briefing for a serious athlete.
Write exactly one paragraph of 5-6 flowing sentences. Cover:
1. Recovery status (sleep, HRV, resting HR)
2. Training completed today (if any)
3. One specific, actionable training recommendation based on the recent workout history data provided

The training recommendation MUST be concrete and specific — name a specific exercise, rep range, or weight target. Examples of good recommendations:
- "Your rear delts haven't been hit in 12 days — add 3x15 face pulls today."
- "You've been pressing 85kg for 6 reps three sessions running — push for 90kg x 4 today."
- "All your squat work has been 3x10 — throw in a heavy set of 3 to maintain strength."
- "Your brachialis is undertrained — swap one curl variation for hammer curls."

Do NOT give generic advice like "listen to your body" or "stay hydrated."
Reference specific numbers from the data. Be direct and encouraging.
No markdown, no bullet points, no headers.`;

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

export function buildDailySummaryPrompt(input: DailySummaryPromptInput): string {
  const lines: string[] = [];
  lines.push(`Today: ${input.date}`);
  lines.push("");

  // Recovery
  lines.push("RECOVERY:");
  if (input.recovery) {
    const r = input.recovery;
    if (r.sleep_hours != null) lines.push(`- Sleep: ${r.sleep_hours}h${r.sleep_score != null ? ` (score: ${r.sleep_score})` : ""}`);
    if (r.hrv != null) lines.push(`- HRV: ${r.hrv}${input.avgHrv7 != null ? ` (7-day avg: ${input.avgHrv7})` : ""}`);
    if (r.resting_hr != null) lines.push(`- Resting HR: ${r.resting_hr} bpm`);
    if (r.body_battery != null) lines.push(`- Body Battery: ${r.body_battery}`);
    if (r.stress_level != null) lines.push(`- Stress: ${r.stress_level}`);
    if (r.steps != null) lines.push(`- Steps: ${r.steps.toLocaleString()}`);
  } else {
    lines.push("- No recovery data synced today");
  }
  lines.push("");

  // Activities today
  lines.push("ACTIVITIES TODAY:");
  const hasActivities = input.workoutsToday.length > 0 || input.cardioToday.length > 0;
  if (!hasActivities) {
    lines.push("- No activities logged yet");
  } else {
    let idx = 1;
    for (const c of input.cardioToday) {
      const parts = [c.type.charAt(0).toUpperCase() + c.type.slice(1)];
      if (c.distance > 0) parts.push(`${c.distance} km`);
      parts.push(fmtDuration(c.duration));
      if (c.avg_hr != null) parts.push(`avg HR ${c.avg_hr}`);
      if (c.pace_or_speed != null && c.type === "run") parts.push(`pace ${fmtPace(c.pace_or_speed)}`);
      if (c.calories != null) parts.push(`${Math.round(c.calories)} kcal`);
      lines.push(`${idx}. ${parts.join(" — ")}`);
      idx++;
    }
    for (const w of input.workoutsToday) {
      lines.push(`${idx}. ${w.name} — ${w.duration_minutes} min, ${w.exerciseCount} exercises`);
      idx++;
    }
  }
  lines.push("");

  // Planned today
  if (input.plannedToday) {
    lines.push(`PLANNED TODAY: ${input.plannedToday}`);
    lines.push("");
  }

  // Muscle volume
  const mv = input.trainingHistory.muscleVolume;
  const mvKeys = Object.keys(mv);
  if (mvKeys.length > 0) {
    lines.push("MUSCLE VOLUME (last 14 days, sets):");
    for (const muscle of mvKeys) {
      const v = mv[muscle];
      lines.push(`- ${muscle}: ${v.sets} sets${v.volume > 0 ? `, ${Math.round(v.volume)} kg total volume` : ""}`);
    }
    lines.push("");
  }

  // Exercise history
  const eh = input.trainingHistory.exerciseHistory;
  if (eh.length > 0) {
    lines.push("EXERCISE HISTORY (last 14 days):");
    for (const e of eh) {
      const parts = [`best ${e.bestWeight}kg x ${e.bestReps}`];
      if (e.lastRpe != null) parts.push(`last RPE ${e.lastRpe}`);
      parts.push(`${e.sessions} session${e.sessions > 1 ? "s" : ""}`);
      if (e.sessions >= 2) parts.push(`(${e.progression})`);
      lines.push(`- ${e.name}: ${parts.join(", ")}`);
    }
    lines.push("");
  }

  // Upcoming races
  if (input.upcomingEvents && input.upcomingEvents.length > 0) {
    lines.push("UPCOMING RACES:");
    for (const ev of input.upcomingEvents) {
      const parts = [`${ev.name} (${ev.priority || "?"} race)`];
      parts.push(`${ev.event_date} — ${ev.days_away} days away`);
      if (ev.goal_time) parts.push(`goal: ${ev.goal_time}`);
      lines.push(`- ${parts.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
