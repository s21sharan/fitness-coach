# Daily Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent AI-generated daily briefing card at the top of the dashboard that summarizes today's recovery, activities, and gives one specific training recommendation based on 14-day workout history.

**Architecture:** New Supabase table `daily_summaries` caches one AI summary per user per day. A Next.js API route fetches today's recovery/activity/workout data, hashes it, and either returns the cached summary or generates a new one via the Anthropic SDK. A client component at the top of the dashboard page fetches and displays the summary.

**Tech Stack:** Supabase (PostgreSQL), Next.js API routes, `@anthropic-ai/sdk`, `computeMuscleVolume()` from `src/lib/exercise-muscles.ts`, Vitest

**Spec:** `docs/superpowers/specs/2026-05-12-daily-summary-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/009_daily_summaries.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 009_daily_summaries.sql
create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  summary text not null,
  data_hash text not null,
  generated_at timestamptz not null default now(),
  unique(user_id, date)
);

create index idx_daily_summaries_user_date on public.daily_summaries(user_id, date);
```

- [ ] **Step 2: Push migration**

Run: `npx supabase db push`
Expected: migration applies successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_daily_summaries.sql
git commit -m "feat: add daily_summaries table for cached AI briefings"
```

---

### Task 2: Training History Helper

A pure function that takes 14 days of workout logs and returns structured training analysis (muscle volume, exercise history, weight progression). This keeps the API route clean and makes the logic testable.

**Files:**
- Create: `src/lib/training/training-history.ts`
- Create: `__tests__/lib/training/training-history.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/training/training-history.test.ts
import { describe, it, expect } from "vitest";
import { buildTrainingHistory, type TrainingHistory } from "@/lib/training/training-history";

const makeWorkout = (date: string, exercises: Array<{ name: string; sets: Array<{ weight_kg: number; reps: number; rpe: number | null }> }>) => ({
  date,
  workout_id: `w-${date}`,
  name: "Test",
  duration_minutes: 60,
  exercises,
});

describe("buildTrainingHistory", () => {
  it("computes muscle volume from exercises", () => {
    const workouts = [
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 8, rpe: 7 }, { weight_kg: 80, reps: 8, rpe: 8 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    expect(result.muscleVolume.chest.sets).toBe(2);
    expect(result.muscleVolume.chest.volume).toBe(80 * 8 * 2);
  });

  it("tracks exercise history with best set and session count", () => {
    const workouts = [
      makeWorkout("2026-05-08", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 6, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 85, reps: 6, rpe: 9 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    const bench = result.exerciseHistory.find(e => e.name === "Bench Press (Barbell)");
    expect(bench).toBeDefined();
    expect(bench!.sessions).toBe(2);
    expect(bench!.bestWeight).toBe(85);
    expect(bench!.bestReps).toBe(6);
    expect(bench!.lastRpe).toBe(9);
    expect(bench!.progression).toBe("up");
  });

  it("detects weight plateau (same weight across sessions)", () => {
    const workouts = [
      makeWorkout("2026-05-06", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-08", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
      makeWorkout("2026-05-10", [
        { name: "Squat (Barbell)", sets: [{ weight_kg: 100, reps: 5, rpe: 8 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    const squat = result.exerciseHistory.find(e => e.name === "Squat (Barbell)");
    expect(squat!.progression).toBe("plateau");
  });

  it("identifies muscles with zero volume", () => {
    const workouts = [
      makeWorkout("2026-05-10", [
        { name: "Bench Press (Barbell)", sets: [{ weight_kg: 80, reps: 8, rpe: 7 }] },
      ]),
    ];
    const result = buildTrainingHistory(workouts);
    expect(result.muscleVolume.calves.sets).toBe(0);
    expect(result.muscleVolume.core.sets).toBe(0);
  });

  it("returns empty structures when no workouts", () => {
    const result = buildTrainingHistory([]);
    expect(result.exerciseHistory).toEqual([]);
    expect(result.muscleVolume.chest.sets).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/training/training-history.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/training/training-history.ts
import { computeMuscleVolume, MUSCLE_GROUPS } from "@/lib/exercise-muscles";

interface WorkoutInput {
  date: string;
  exercises: Array<{
    name: string;
    sets: Array<{ weight_kg: number; reps: number; rpe: number | null }>;
  }>;
}

export interface ExerciseHistoryEntry {
  name: string;
  sessions: number;
  bestWeight: number;
  bestReps: number;
  totalSets: number;
  lastRpe: number | null;
  progression: "up" | "down" | "plateau" | "single";
}

export interface TrainingHistory {
  muscleVolume: Record<string, { sets: number; volume: number }>;
  exerciseHistory: ExerciseHistoryEntry[];
}

export function buildTrainingHistory(workouts: WorkoutInput[]): TrainingHistory {
  // Aggregate all exercises for muscle volume
  const allExercises: Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }> = [];
  for (const w of workouts) {
    if (!Array.isArray(w.exercises)) continue;
    for (const ex of w.exercises) {
      allExercises.push({ name: ex.name, sets: ex.sets });
    }
  }
  const rawVolume = computeMuscleVolume(allExercises);

  // Ensure all 11 muscle groups are present (even with 0)
  const muscleVolume: Record<string, { sets: number; volume: number }> = {};
  for (const g of MUSCLE_GROUPS) {
    muscleVolume[g] = rawVolume[g] ?? { sets: 0, volume: 0 };
  }

  // Build per-exercise history
  // Group by exercise name, track per-session max weight
  const exerciseMap = new Map<string, { sessionWeights: number[]; totalSets: number; bestWeight: number; bestReps: number; lastRpe: number | null }>();

  // Sort workouts by date ascending so "last" RPE is most recent
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  for (const w of sorted) {
    if (!Array.isArray(w.exercises)) continue;
    for (const ex of w.exercises) {
      if (!exerciseMap.has(ex.name)) {
        exerciseMap.set(ex.name, { sessionWeights: [], totalSets: 0, bestWeight: 0, bestReps: 0, lastRpe: null });
      }
      const entry = exerciseMap.get(ex.name)!;
      entry.totalSets += ex.sets.length;

      let sessionMax = 0;
      for (const s of ex.sets) {
        if (s.weight_kg > entry.bestWeight || (s.weight_kg === entry.bestWeight && s.reps > entry.bestReps)) {
          entry.bestWeight = s.weight_kg;
          entry.bestReps = s.reps;
        }
        if (s.weight_kg > sessionMax) sessionMax = s.weight_kg;
        if (s.rpe != null) entry.lastRpe = s.rpe;
      }
      entry.sessionWeights.push(sessionMax);
    }
  }

  const exerciseHistory: ExerciseHistoryEntry[] = [];
  for (const [name, data] of exerciseMap) {
    let progression: ExerciseHistoryEntry["progression"] = "single";
    if (data.sessionWeights.length >= 2) {
      const first = data.sessionWeights[0];
      const last = data.sessionWeights[data.sessionWeights.length - 1];
      const allSame = data.sessionWeights.every(w => w === first);
      if (allSame && data.sessionWeights.length >= 2) {
        progression = "plateau";
      } else if (last > first) {
        progression = "up";
      } else if (last < first) {
        progression = "down";
      }
    }

    exerciseHistory.push({
      name,
      sessions: data.sessionWeights.length,
      bestWeight: data.bestWeight,
      bestReps: data.bestReps,
      totalSets: data.totalSets,
      lastRpe: data.lastRpe,
      progression,
    });
  }

  return { muscleVolume, exerciseHistory };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/training-history.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/training-history.ts __tests__/lib/training/training-history.test.ts
git commit -m "feat: add buildTrainingHistory for 14-day exercise analysis"
```

---

### Task 3: Prompt Builder Helper

A pure function that takes today's recovery, activities, training history, and planned workout, and returns the formatted prompt string for Claude. Keeps the API route thin and this logic testable.

**Files:**
- Create: `src/lib/training/daily-summary-prompt.ts`
- Create: `__tests__/lib/training/daily-summary-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/training/daily-summary-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildDailySummaryPrompt, DAILY_SUMMARY_SYSTEM_PROMPT } from "@/lib/training/daily-summary-prompt";

describe("buildDailySummaryPrompt", () => {
  it("includes recovery data in prompt", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: { sleep_hours: 7.2, sleep_score: 82, hrv: 52, resting_hr: 54, body_battery: 71, stress_level: 28, steps: 4200 },
      avgHrv7: 48,
      workoutsToday: [],
      cardioToday: [],
      plannedToday: null,
      trainingHistory: { muscleVolume: {}, exerciseHistory: [] },
    });
    expect(prompt).toContain("Sleep: 7.2h (score: 82)");
    expect(prompt).toContain("HRV: 52 (7-day avg: 48)");
    expect(prompt).toContain("Resting HR: 54 bpm");
  });

  it("includes cardio activities", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: null,
      avgHrv7: null,
      workoutsToday: [],
      cardioToday: [{ type: "run", distance: 8.1, duration: 2730, avg_hr: 138, pace_or_speed: 5.62, calories: 412, elevation: 45 }],
      plannedToday: null,
      trainingHistory: { muscleVolume: {}, exerciseHistory: [] },
    });
    expect(prompt).toContain("Run");
    expect(prompt).toContain("8.1 km");
  });

  it("includes muscle volume and exercise history", () => {
    const prompt = buildDailySummaryPrompt({
      date: "2026-05-12",
      recovery: null,
      avgHrv7: null,
      workoutsToday: [],
      cardioToday: [],
      plannedToday: "Pull day",
      trainingHistory: {
        muscleVolume: { chest: { sets: 18, volume: 14400 }, calves: { sets: 0, volume: 0 } },
        exerciseHistory: [
          { name: "Bench Press", sessions: 3, bestWeight: 85, bestReps: 6, totalSets: 9, lastRpe: 8, progression: "plateau" as const },
        ],
      },
    });
    expect(prompt).toContain("PLANNED TODAY: Pull day");
    expect(prompt).toContain("chest: 18 sets");
    expect(prompt).toContain("calves: 0 sets");
    expect(prompt).toContain("Bench Press");
    expect(prompt).toContain("plateau");
  });

  it("system prompt requires specific recommendations", () => {
    expect(DAILY_SUMMARY_SYSTEM_PROMPT).toContain("specific");
    expect(DAILY_SUMMARY_SYSTEM_PROMPT).toContain("exercise");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/training/daily-summary-prompt.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/training/daily-summary-prompt.ts
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

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/daily-summary-prompt.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/daily-summary-prompt.ts __tests__/lib/training/daily-summary-prompt.test.ts
git commit -m "feat: add daily summary prompt builder with training history"
```

---

### Task 4: API Route

**Files:**
- Create: `src/app/api/daily-summary/route.ts`
- Create: `__tests__/app/api/daily-summary/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/api/daily-summary/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-1" })),
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "daily_summaries") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
      upsert: mockUpsert.mockReturnValue(Promise.resolve({ error: null })),
    };
  }
  // recovery_logs, workout_logs, cardio_logs, planned_workouts
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({ gte: () => Promise.resolve({ data: [], error: null }) }),
        gte: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

const mockCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "Great recovery today with solid HRV numbers." }],
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create: mockCreate } })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/daily-summary", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });

    const { POST } = await import("@/app/api/daily-summary/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(401);
  });

  it("returns generated summary when no cache exists", async () => {
    const { POST } = await import("@/app/api/daily-summary/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ date: "2026-05-12" }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary).toBe("Great recovery today with solid HRV numbers.");
    expect(body.cached).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/app/api/daily-summary/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/daily-summary/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { buildTrainingHistory } from "@/lib/training/training-history";
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

  const [recoveryRes, workoutsTodayRes, cardioTodayRes, workoutsHistRes, plannedRes, recovery7Res] = await Promise.all([
    supabase.from("recovery_logs").select("sleep_hours, sleep_score, hrv, resting_hr, body_battery, stress_level, steps").eq("user_id", userId).eq("date", date).single(),
    supabase.from("workout_logs").select("name, duration_minutes, exercises").eq("user_id", userId).eq("date", date),
    supabase.from("cardio_logs").select("type, distance, duration, avg_hr, pace_or_speed, calories, elevation").eq("user_id", userId).eq("date", date),
    supabase.from("workout_logs").select("date, exercises").eq("user_id", userId).gte("date", since14),
    supabase.from("planned_workouts").select("session_type").eq("date", date).limit(1),
    supabase.from("recovery_logs").select("hrv").eq("user_id", userId).gte("date", since7),
  ]);

  const recovery = recoveryRes.data;
  const workoutsToday = workoutsTodayRes.data || [];
  const cardioToday = cardioTodayRes.data || [];
  const workoutsHist = workoutsHistRes.data || [];
  const plannedToday = (plannedRes.data?.[0] as { session_type?: string } | undefined)?.session_type || null;

  // No data at all — return empty
  if (!recovery && workoutsToday.length === 0 && cardioToday.length === 0) {
    return NextResponse.json({ summary: null, generated_at: null, cached: false });
  }

  // Compute 7-day avg HRV
  const hrvValues = (recovery7Res.data || []).map(r => r.hrv).filter((v): v is number => v != null);
  const avgHrv7 = hrvValues.length > 0 ? Math.round(hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length) : null;

  // Build training history
  const trainingHistory = buildTrainingHistory(
    workoutsHist.map(w => ({
      date: w.date,
      exercises: Array.isArray(w.exercises) ? w.exercises : [],
    }))
  );

  // Hash all data for cache invalidation
  const dataForHash = JSON.stringify({ recovery, workoutsToday, cardioToday, trainingHistory });
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
    workoutsToday: workoutsToday.map(w => ({
      name: w.name || "Workout",
      duration_minutes: w.duration_minutes || 0,
      exerciseCount: Array.isArray(w.exercises) ? w.exercises.length : 0,
    })),
    cardioToday: cardioToday.map(c => ({
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
  });

  // Generate via Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: DAILY_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = message.content[0].type === "text" ? message.content[0].text : "";
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/app/api/daily-summary/route.test.ts`
Expected: both tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/daily-summary/route.ts __tests__/app/api/daily-summary/route.test.ts
git commit -m "feat: add /api/daily-summary route with cache + training intelligence"
```

---

### Task 5: DailySummaryCard Component

**Files:**
- Create: `src/components/dashboard/daily-summary-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/dashboard/daily-summary-card.tsx
"use client";

import { useEffect, useState } from "react";

interface DailySummaryData {
  summary: string | null;
  generated_at: string | null;
  cached: boolean;
}

function formatGreeting(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const month = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${day}, ${month}`;
}

export function DailySummaryCard() {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch("/api/daily-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Error state — hide the card entirely
  if (!loading && !data) return null;

  // No data for today — show muted message
  if (!loading && data && !data.summary) {
    return (
      <div style={{
        background: "#f9fafb",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{formatGreeting()}</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 10 }}>
          No data synced for today yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 16,
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 }}>Today</div>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginBottom: 10 }}>{formatGreeting()}</div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "92%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.2s" }} />
          <div style={{ height: 12, background: "#e5e7eb", borderRadius: 4, width: "78%", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.4s" }} />
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "#374151" }}>
          {data!.summary}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/daily-summary-card.tsx
git commit -m "feat: add DailySummaryCard component with loading skeleton"
```

---

### Task 6: Wire Into Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/app/dashboard/page.tsx`, add after the existing imports (around line 12):

```typescript
import { DailySummaryCard } from "@/components/dashboard/daily-summary-card";
```

- [ ] **Step 2: Add the component to the render**

In the `DashboardPage` component's return JSX (around line 688), insert `<DailySummaryCard />` between `<ConnectionBar>` and the charts grid:

Find this block:
```typescript
      <ConnectionBar integrations={data.integrations} syncing={syncing} onSync={triggerSync} />

      {/* ─── CHARTS GRID ─── */}
```

Replace with:
```typescript
      <ConnectionBar integrations={data.integrations} syncing={syncing} onSync={triggerSync} />

      <DailySummaryCard />

      {/* ─── CHARTS GRID ─── */}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -E "daily-summary|dashboard/page" || echo "No errors"`
Expected: "No errors"

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: render DailySummaryCard at top of dashboard"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open the dashboard in browser**

Navigate to `http://localhost:3000/dashboard`. Verify:
- The daily summary card appears at the top, above the charts
- It shows "Today" with the formatted date
- It shows a loading skeleton briefly, then the AI-generated summary
- The summary references actual recovery numbers and includes a specific training recommendation
- If no data is synced for today, it shows "No data synced for today yet"

- [ ] **Step 3: Verify cache**

Reload the page. The summary should appear instantly (cached). Check the network tab — the response should have `"cached": true`.

- [ ] **Step 4: Stop dev server**
