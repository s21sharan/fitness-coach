# Phase 7: Dashboard & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the dashboard with real data — today's session, weekly training strip, quick stats with progress bars and gauges, and quick action buttons.

**Architecture:** New `/api/dashboard` route aggregates data from multiple Supabase tables. Dashboard page becomes a client component using small, focused stat components. Reuses `WeekStrip` from Phase 4.

**Tech Stack:** React, Tailwind, Supabase, Vitest

**Design Spec:** `docs/superpowers/specs/2026-05-01-phase7-dashboard-polish-design.md`

---

## File Structure

```
# API
src/app/api/dashboard/route.ts                        # GET aggregated dashboard data

# Components
src/components/dashboard/today-card.tsx                # Today's session + recovery + actions
src/components/dashboard/calories-card.tsx             # Calories progress bar
src/components/dashboard/weight-card.tsx               # Weight + direction arrow
src/components/dashboard/recovery-card.tsx             # Recovery readiness gauge
src/components/dashboard/quick-actions.tsx             # Chat + Plan buttons

# Modified
src/app/dashboard/page.tsx                             # Rewritten with real data

# Tests
__tests__/components/dashboard/today-card.test.tsx
__tests__/components/dashboard/calories-card.test.tsx
__tests__/components/dashboard/recovery-card.test.tsx
```

---

## Task 1: Dashboard API Route

**Files:**
- Create: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: Create dashboard API route**

```typescript
// src/app/api/dashboard/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function calculateReadiness(hrv: number | null, sleepHours: number | null, bodyBattery: number | null): "good" | "fair" | "low" {
  if ((hrv !== null && hrv >= 50) || (bodyBattery !== null && bodyBattery >= 60) || (sleepHours !== null && sleepHours >= 7)) {
    return "good";
  }
  if ((hrv !== null && hrv >= 35) || (bodyBattery !== null && bodyBattery >= 40) || (sleepHours !== null && sleepHours >= 6)) {
    return "fair";
  }
  return "low";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Get active plan
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  // Today's session
  let todaySession: { date: string; session_type: string | null; ai_notes: string | null } = {
    date: todayStr,
    session_type: null,
    ai_notes: null,
  };

  let weekWorkouts: unknown[] = [];

  if (plan) {
    const { data: todayWorkout } = await supabase
      .from("planned_workouts")
      .select("session_type, ai_notes")
      .eq("plan_id", plan.id)
      .eq("date", todayStr)
      .single();

    if (todayWorkout) {
      todaySession.session_type = todayWorkout.session_type;
      todaySession.ai_notes = todayWorkout.ai_notes;
    }

    // Week's workouts
    const { data: workouts } = await supabase
      .from("planned_workouts")
      .select("id, date, day_of_week, session_type, ai_notes, status, approved")
      .eq("plan_id", plan.id)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr)
      .order("date");

    weekWorkouts = workouts || [];
  }

  // Week completions (Hevy + Strava)
  const [workoutLogsRes, cardioLogsRes] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("date, name, duration_minutes, exercises")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration, avg_hr, pace_or_speed")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
  ]);

  const weekCompletions: Record<string, unknown> = {};
  for (const log of workoutLogsRes.data || []) {
    if (!weekCompletions[log.date]) weekCompletions[log.date] = {};
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    (weekCompletions[log.date] as Record<string, unknown>).workout = {
      name: log.name,
      duration_minutes: log.duration_minutes,
      exercise_count: exercises.length,
    };
  }
  for (const log of cardioLogsRes.data || []) {
    if (!weekCompletions[log.date]) weekCompletions[log.date] = {};
    const entry = weekCompletions[log.date] as Record<string, unknown>;
    if (!entry.cardio) entry.cardio = [];
    (entry.cardio as unknown[]).push({
      type: log.type,
      distance: log.distance,
      duration: log.duration,
      avg_hr: log.avg_hr,
      pace_or_speed: log.pace_or_speed,
    });
  }

  // Today's nutrition
  const { data: todayNutrition } = await supabase
    .from("nutrition_logs")
    .select("calories, protein")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  // 7-day calorie average for target
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const { data: recentNutrition } = await supabase
    .from("nutrition_logs")
    .select("calories")
    .eq("user_id", userId)
    .gte("date", sevenDaysAgo.toISOString().slice(0, 10))
    .lt("date", todayStr);

  let targetCalories = 2000;
  if (recentNutrition && recentNutrition.length > 0) {
    targetCalories = Math.round(recentNutrition.reduce((s, n) => s + n.calories, 0) / recentNutrition.length);
  }

  // Today's recovery
  const { data: todayRecovery } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours, body_battery")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  // Weight trend
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("weight")
    .eq("user_id", userId)
    .single();

  let weightDirection: "up" | "down" | "stable" = "stable";
  // Simple: if we had weight history we'd calculate trend. For now, just stable.

  return NextResponse.json({
    today: todaySession,
    weekWorkouts,
    weekCompletions,
    weekStart: weekStartStr,
    nutrition: todayNutrition ? {
      calories: todayNutrition.calories,
      protein: todayNutrition.protein,
      target_calories: targetCalories,
    } : null,
    recovery: todayRecovery ? {
      hrv: todayRecovery.hrv,
      sleep_hours: todayRecovery.sleep_hours,
      body_battery: todayRecovery.body_battery,
      readiness: calculateReadiness(todayRecovery.hrv, todayRecovery.sleep_hours, todayRecovery.body_battery),
    } : null,
    weight: {
      current: profile?.weight || null,
      direction: weightDirection,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: add dashboard API route aggregating plan, nutrition, recovery, and weight data"
```

---

## Task 2: Dashboard Stat Components

**Files:**
- Create: `src/components/dashboard/today-card.tsx`
- Create: `src/components/dashboard/calories-card.tsx`
- Create: `src/components/dashboard/weight-card.tsx`
- Create: `src/components/dashboard/recovery-card.tsx`
- Create: `src/components/dashboard/quick-actions.tsx`
- Test: `__tests__/components/dashboard/today-card.test.tsx`
- Test: `__tests__/components/dashboard/calories-card.test.tsx`
- Test: `__tests__/components/dashboard/recovery-card.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// __tests__/components/dashboard/today-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayCard } from "@/components/dashboard/today-card";

describe("TodayCard", () => {
  it("renders today's session", () => {
    render(
      <TodayCard
        sessionType="Push"
        aiNotes="HRV 52 — push hard today"
        recovery={{ hrv: 52, sleep_hours: 7.8, body_battery: 75 }}
      />,
    );
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.getByText(/HRV 52/)).toBeDefined();
  });

  it("renders rest day", () => {
    render(<TodayCard sessionType="Rest" aiNotes={null} recovery={null} />);
    expect(screen.getByText("Rest Day")).toBeDefined();
  });

  it("renders no plan state", () => {
    render(<TodayCard sessionType={null} aiNotes={null} recovery={null} />);
    expect(screen.getByText(/No session planned/i)).toBeDefined();
  });
});
```

```typescript
// __tests__/components/dashboard/calories-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaloriesCard } from "@/components/dashboard/calories-card";

describe("CaloriesCard", () => {
  it("renders calories with progress bar", () => {
    render(<CaloriesCard calories={1800} target={2400} protein={142} />);
    expect(screen.getByText("1,800")).toBeDefined();
    expect(screen.getByText(/2,400/)).toBeDefined();
    expect(screen.getByText(/142g protein/)).toBeDefined();
  });

  it("renders no data state", () => {
    render(<CaloriesCard calories={null} target={2000} protein={null} />);
    expect(screen.getByText("No data today")).toBeDefined();
  });
});
```

```typescript
// __tests__/components/dashboard/recovery-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecoveryCard } from "@/components/dashboard/recovery-card";

describe("RecoveryCard", () => {
  it("renders good readiness", () => {
    render(<RecoveryCard hrv={52} sleepHours={7.8} bodyBattery={75} readiness="good" />);
    expect(screen.getByText("Good")).toBeDefined();
    expect(screen.getByText(/52/)).toBeDefined();
    expect(screen.getByText(/7.8h/)).toBeDefined();
  });

  it("renders low readiness", () => {
    render(<RecoveryCard hrv={28} sleepHours={5.2} bodyBattery={30} readiness="low" />);
    expect(screen.getByText("Low")).toBeDefined();
  });

  it("renders no data state", () => {
    const { container } = render(<RecoveryCard hrv={null} sleepHours={null} bodyBattery={null} readiness={null} />);
    expect(screen.getByText("No data today")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL. Then implement all components:**

```tsx
// src/components/dashboard/today-card.tsx
"use client";

import Link from "next/link";

interface TodayCardProps {
  sessionType: string | null;
  aiNotes: string | null;
  recovery: { hrv: number | null; sleep_hours: number | null; body_battery: number | null } | null;
}

export function TodayCard({ sessionType, aiNotes, recovery }: TodayCardProps) {
  const isRest = sessionType === "Rest";
  const hasSession = sessionType && !isRest;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-500">Today</h2>
          {hasSession ? (
            <p className="mt-1 text-2xl font-bold">{sessionType}</p>
          ) : isRest ? (
            <p className="mt-1 text-2xl font-bold text-gray-400">Rest Day</p>
          ) : (
            <p className="mt-1 text-lg text-gray-400">No session planned</p>
          )}
          {aiNotes && (
            <p className="mt-1 text-sm text-blue-600 italic">{aiNotes}</p>
          )}
        </div>

        {/* Recovery badges */}
        {recovery && (
          <div className="flex gap-2">
            {recovery.hrv !== null && (
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                HRV {recovery.hrv}
              </span>
            )}
            {recovery.sleep_hours !== null && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {recovery.sleep_hours}h sleep
              </span>
            )}
            {recovery.body_battery !== null && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                BB {recovery.body_battery}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-4 flex gap-3">
        <Link
          href="/dashboard/chat"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Chat with Coach
        </Link>
        <Link
          href="/dashboard/plan"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          View Plan
        </Link>
      </div>
    </div>
  );
}
```

```tsx
// src/components/dashboard/calories-card.tsx
"use client";

interface CaloriesCardProps {
  calories: number | null;
  target: number;
  protein: number | null;
}

export function CaloriesCard({ calories, target, protein }: CaloriesCardProps) {
  if (calories === null) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Calories</h3>
        <p className="mt-2 text-sm text-gray-400">No data today</p>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((calories / target) * 100));
  const barColor = pct >= 90 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-gray-300";

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Calories</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{calories.toLocaleString()}</span>
        <span className="text-sm text-gray-400">/ {target.toLocaleString()} cal</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {protein !== null && (
        <p className="mt-1.5 text-xs text-gray-500">{protein}g protein</p>
      )}
    </div>
  );
}
```

```tsx
// src/components/dashboard/weight-card.tsx
"use client";

interface WeightCardProps {
  current: number | null;
  direction: "up" | "down" | "stable";
}

const ARROWS: Record<string, { icon: string; color: string }> = {
  up: { icon: "↑", color: "text-red-500" },
  down: { icon: "↓", color: "text-green-500" },
  stable: { icon: "→", color: "text-gray-400" },
};

export function WeightCard({ current, direction }: WeightCardProps) {
  if (current === null) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Weight</h3>
        <p className="mt-2 text-sm text-gray-400">No data</p>
      </div>
    );
  }

  const arrow = ARROWS[direction];

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Weight</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{current}</span>
        <span className="text-sm text-gray-400">lbs</span>
        <span className={`text-lg font-bold ${arrow.color}`}>{arrow.icon}</span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {direction === "up" ? "Trending up" : direction === "down" ? "Trending down" : "Stable"}
      </p>
    </div>
  );
}
```

```tsx
// src/components/dashboard/recovery-card.tsx
"use client";

interface RecoveryCardProps {
  hrv: number | null;
  sleepHours: number | null;
  bodyBattery: number | null;
  readiness: "good" | "fair" | "low" | null;
}

const READINESS_CONFIG: Record<string, { label: string; color: string; bgColor: string; pct: number }> = {
  good: { label: "Good", color: "text-green-600", bgColor: "bg-green-500", pct: 90 },
  fair: { label: "Fair", color: "text-amber-600", bgColor: "bg-amber-500", pct: 55 },
  low: { label: "Low", color: "text-red-600", bgColor: "bg-red-500", pct: 25 },
};

export function RecoveryCard({ hrv, sleepHours, bodyBattery, readiness }: RecoveryCardProps) {
  if (!readiness) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
        <p className="mt-2 text-sm text-gray-400">No data today</p>
      </div>
    );
  }

  const config = READINESS_CONFIG[readiness];

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${config.color}`}>{config.label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${config.bgColor}`} style={{ width: `${config.pct}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-xs text-gray-500">
        {hrv !== null && <span>HRV {hrv}</span>}
        {sleepHours !== null && <span>{sleepHours}h sleep</span>}
        {bodyBattery !== null && <span>BB {bodyBattery}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- __tests__/components/dashboard/today-card.test.tsx __tests__/components/dashboard/calories-card.test.tsx __tests__/components/dashboard/recovery-card.test.tsx`
Expected: 8 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/today-card.tsx src/components/dashboard/calories-card.tsx src/components/dashboard/weight-card.tsx src/components/dashboard/recovery-card.tsx __tests__/components/dashboard/
git commit -m "feat: add dashboard stat components (today card, calories, weight, recovery)"
```

---

## Task 3: Rewrite Dashboard Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Read existing file, then replace entirely with:**

```tsx
// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { TodayCard } from "@/components/dashboard/today-card";
import { WeekStrip } from "@/components/plan/week-strip";
import { CaloriesCard } from "@/components/dashboard/calories-card";
import { WeightCard } from "@/components/dashboard/weight-card";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { SyncStatus } from "@/components/dashboard/sync-status";

interface DashboardData {
  today: {
    date: string;
    session_type: string | null;
    ai_notes: string | null;
  };
  weekWorkouts: Array<{
    id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    status: string;
    approved: boolean;
  }>;
  weekCompletions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }>;
  weekStart: string;
  nutrition: {
    calories: number;
    protein: number;
    target_calories: number;
  } | null;
  recovery: {
    hrv: number | null;
    sleep_hours: number | null;
    body_battery: number | null;
    readiness: "good" | "fair" | "low";
  } | null;
  weight: {
    current: number | null;
    direction: "up" | "down" | "stable";
  } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard");
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <SyncStatus />

      <TodayCard
        sessionType={data?.today.session_type ?? null}
        aiNotes={data?.today.ai_notes ?? null}
        recovery={data?.recovery ? {
          hrv: data.recovery.hrv,
          sleep_hours: data.recovery.sleep_hours,
          body_battery: data.recovery.body_battery,
        } : null}
      />

      {data?.weekWorkouts && data.weekWorkouts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">This Week</h2>
          <WeekStrip
            workouts={data.weekWorkouts}
            completions={data.weekCompletions}
            weekStart={data.weekStart}
            today={today}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <CaloriesCard
          calories={data?.nutrition?.calories ?? null}
          target={data?.nutrition?.target_calories ?? 2000}
          protein={data?.nutrition?.protein ?? null}
        />
        <WeightCard
          current={data?.weight?.current ?? null}
          direction={data?.weight?.direction ?? "stable"}
        />
        <RecoveryCard
          hrv={data?.recovery?.hrv ?? null}
          sleepHours={data?.recovery?.sleep_hours ?? null}
          bodyBattery={data?.recovery?.body_battery ?? null}
          readiness={data?.recovery?.readiness ?? null}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: wire dashboard with real data — today's session, weekly strip, and quick stats"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 2: Run all server tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run`
Expected: All PASS

- [ ] **Step 3: Verify git status**

Run: `git status`
Expected: Clean
