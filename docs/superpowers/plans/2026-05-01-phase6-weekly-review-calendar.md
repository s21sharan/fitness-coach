# Phase 6: Weekly Review & Google Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Weekly Review page showing AI-generated summaries with historical check-ins, and add full Google Calendar integration — OAuth connect, read availability, write sessions as events, detect reschedules.

**Architecture:** Review page reads from existing `weekly_check_ins` table via a new API route. Google Calendar uses OAuth 2.0 following the Strava pattern — authorize/callback routes, token storage in `integrations` table, a Calendar client for read/write, and reschedule detection on the Sunday cron.

**Tech Stack:** googleapis, React, Tailwind, Supabase, Express, Vitest

**Design Spec:** `docs/superpowers/specs/2026-05-01-phase6-weekly-review-calendar-design.md`

---

## File Structure

```
# Database
supabase/migrations/004_planned_workouts_time.sql       # Add scheduled_time column

# Weekly Review
src/app/api/review/route.ts                              # GET current + historical check-ins
src/components/review/week-summary.tsx                    # Current week's AI summary + stats
src/components/review/stat-card.tsx                       # Individual stat card (compliance, cals, etc.)
src/components/review/check-in-history.tsx                # Expandable historical list
src/app/dashboard/review/page.tsx                         # Rewritten review page

# Google Calendar OAuth
src/app/api/integrations/google-calendar/authorize/route.ts
src/app/api/integrations/google-calendar/callback/route.ts

# Google Calendar Client
src/lib/google-calendar.ts                                # Calendar API wrapper (Next.js side)
server/src/integrations/google-calendar-client.ts         # Calendar API wrapper (server side)

# Calendar Event Management
src/app/api/plan/calendar-sync/route.ts                   # POST — sync approved plan to calendar

# Modified Files
src/app/api/integrations/status/route.ts                  # Add google_calendar to provider list
src/app/dashboard/settings/page.tsx                       # Add Google Calendar integration card
server/src/sync/scheduler.ts                              # Add reschedule detection to Sunday cron
server/src/adjustment/weekly-check-in.ts                  # Include reschedule data in check-in
server/src/config.ts                                      # Add Google Calendar env vars
server/.env.example                                       # Add Google Calendar env vars

# Tests
__tests__/components/review/stat-card.test.tsx
__tests__/components/review/week-summary.test.tsx
__tests__/components/review/check-in-history.test.tsx
__tests__/lib/google-calendar.test.ts
server/__tests__/integrations/google-calendar-client.test.ts
```

---

## Task 1: Database Migration + Install googleapis

**Files:**
- Create: `supabase/migrations/004_planned_workouts_time.sql`
- Modify: `package.json` (add googleapis)

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/004_planned_workouts_time.sql
ALTER TABLE public.planned_workouts
  ADD COLUMN scheduled_time timestamptz;
```

- [ ] **Step 2: Install googleapis in root**

Run: `npm install googleapis`

- [ ] **Step 3: Install googleapis in server**

Run: `cd server && npm install googleapis`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_planned_workouts_time.sql package.json package-lock.json server/package.json server/package-lock.json
git commit -m "feat: add scheduled_time to planned_workouts and install googleapis"
```

---

## Task 2: Review API Route

**Files:**
- Create: `src/app/api/review/route.ts`

- [ ] **Step 1: Create review API route**

```typescript
// src/app/api/review/route.ts
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

  // Get all check-ins for this user, newest first
  const { data: checkIns, error } = await supabase
    .from("weekly_check_ins")
    .select("id, week_start_date, compliance_pct, avg_calories, avg_protein, avg_sleep_hours, avg_hrv, ai_summary, adjustments, risk_flags, user_approved, created_at")
    .eq("user_id", userId)
    .order("week_start_date", { ascending: false })
    .limit(13); // Current + 12 historical

  if (error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });

  const all = checkIns || [];
  const current = all.length > 0 ? all[0] : null;
  const history = all.slice(1);

  return NextResponse.json({ current, history });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/review/route.ts
git commit -m "feat: add review API route for weekly check-in data"
```

---

## Task 3: Review UI Components

**Files:**
- Create: `src/components/review/stat-card.tsx`
- Create: `src/components/review/week-summary.tsx`
- Create: `src/components/review/check-in-history.tsx`
- Test: `__tests__/components/review/stat-card.test.tsx`
- Test: `__tests__/components/review/week-summary.test.tsx`
- Test: `__tests__/components/review/check-in-history.test.tsx`

- [ ] **Step 1: Write StatCard test**

```typescript
// __tests__/components/review/stat-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/review/stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Compliance" value="83%" />);
    expect(screen.getByText("Compliance")).toBeDefined();
    expect(screen.getByText("83%")).toBeDefined();
  });

  it("applies color variant", () => {
    const { container } = render(<StatCard label="Compliance" value="45%" color="red" />);
    expect(container.innerHTML).toContain("text-red");
  });
});
```

- [ ] **Step 2: Write WeekSummary test**

```typescript
// __tests__/components/review/week-summary.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekSummary } from "@/components/review/week-summary";

describe("WeekSummary", () => {
  it("renders AI summary and stats", () => {
    render(
      <WeekSummary
        checkIn={{
          id: "ci-1",
          week_start_date: "2026-04-28",
          compliance_pct: 83,
          avg_calories: 2400,
          avg_protein: 175,
          avg_sleep_hours: 7.2,
          avg_hrv: 48,
          ai_summary: "Great week overall. Hit 5 of 6 sessions.",
          risk_flags: ["Sleep dipped below 7h on Thursday"],
          adjustments: [{ type: "volume", description: "Reduce volume 10%", affected_days: [0, 2] }],
          user_approved: true,
        }}
      />,
    );
    expect(screen.getByText(/Great week overall/)).toBeDefined();
    expect(screen.getByText("83%")).toBeDefined();
    expect(screen.getByText("2400")).toBeDefined();
    expect(screen.getByText(/Sleep dipped/)).toBeDefined();
  });

  it("renders empty state when no check-in", () => {
    render(<WeekSummary checkIn={null} />);
    expect(screen.getByText(/first weekly review/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Write CheckInHistory test**

```typescript
// __tests__/components/review/check-in-history.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckInHistory } from "@/components/review/check-in-history";

describe("CheckInHistory", () => {
  it("renders list of past check-ins", () => {
    render(
      <CheckInHistory
        history={[
          { id: "1", week_start_date: "2026-04-21", compliance_pct: 100, avg_calories: 2500, avg_protein: 180, avg_sleep_hours: 7.5, avg_hrv: 50, ai_summary: "Perfect compliance. All sessions hit.", risk_flags: null, adjustments: null, user_approved: true, created_at: "" },
          { id: "2", week_start_date: "2026-04-14", compliance_pct: 67, avg_calories: 2200, avg_protein: 160, avg_sleep_hours: 6.5, avg_hrv: 42, ai_summary: "Missed 2 sessions due to travel.", risk_flags: ["Low sleep"], adjustments: null, user_approved: true, created_at: "" },
        ]}
      />,
    );
    expect(screen.getByText(/Apr 21/)).toBeDefined();
    expect(screen.getByText(/Apr 14/)).toBeDefined();
    expect(screen.getByText("100%")).toBeDefined();
    expect(screen.getByText("67%")).toBeDefined();
  });

  it("renders empty state", () => {
    render(<CheckInHistory history={[]} />);
    expect(screen.getByText(/No previous/i)).toBeDefined();
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL. Then implement components:**

```tsx
// src/components/review/stat-card.tsx
"use client";

interface StatCardProps {
  label: string;
  value: string;
  color?: "green" | "amber" | "red" | "default";
}

const COLOR_MAP = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
  default: "text-gray-900",
};

export function StatCard({ label, value, color = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 text-center">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
    </div>
  );
}
```

```tsx
// src/components/review/week-summary.tsx
"use client";

import { StatCard } from "./stat-card";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface CheckIn {
  id: string;
  week_start_date: string;
  compliance_pct: number;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_sleep_hours: number | null;
  avg_hrv: number | null;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Adjustment[] | null;
  user_approved: boolean | null;
}

function complianceColor(pct: number): "green" | "amber" | "red" {
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

function formatWeekRange(startDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function WeekSummary({ checkIn }: { checkIn: CheckIn | null }) {
  if (!checkIn) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-gray-500">Your first weekly review will appear after your first full week of training.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">This Week</h2>
        <span className="text-sm text-gray-500">{formatWeekRange(checkIn.week_start_date)}</span>
      </div>

      {/* AI Summary */}
      <div className="flex gap-3 rounded-lg border bg-white p-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
          <span className="text-sm font-bold text-white">C</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">{checkIn.ai_summary}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Compliance" value={`${checkIn.compliance_pct}%`} color={complianceColor(checkIn.compliance_pct)} />
        <StatCard label="Avg Calories" value={checkIn.avg_calories !== null ? String(checkIn.avg_calories) : "—"} />
        <StatCard label="Avg Protein" value={checkIn.avg_protein !== null ? `${checkIn.avg_protein}g` : "—"} />
        <StatCard label="Avg Sleep" value={checkIn.avg_sleep_hours !== null ? `${checkIn.avg_sleep_hours}h` : "—"} />
        <StatCard label="Avg HRV" value={checkIn.avg_hrv !== null ? String(checkIn.avg_hrv) : "—"} />
      </div>

      {/* Risk Flags */}
      {checkIn.risk_flags && checkIn.risk_flags.length > 0 && (
        <div className="space-y-1">
          {checkIn.risk_flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <span className="text-red-500">⚠</span>
              <p className="text-sm text-red-700">{flag}</p>
            </div>
          ))}
        </div>
      )}

      {/* Adjustments */}
      {checkIn.adjustments && checkIn.adjustments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Adjustments made:</p>
          {checkIn.adjustments.map((adj, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{adj.type}</span>
              <p className="text-sm text-gray-700">{adj.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/components/review/check-in-history.tsx
"use client";

import { useState } from "react";

interface CheckIn {
  id: string;
  week_start_date: string;
  compliance_pct: number;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_sleep_hours: number | null;
  avg_hrv: number | null;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Array<{ type: string; description: string; affected_days: number[] }> | null;
  user_approved: boolean | null;
  created_at: string;
}

function formatWeekRange(startDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function complianceColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

export function CheckInHistory({ history }: { history: CheckIn[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-sm text-gray-400">No previous check-ins yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">History</h2>
      {history.map((ci) => {
        const isExpanded = expandedId === ci.id;
        return (
          <div key={ci.id} className="rounded-lg border bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : ci.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">{formatWeekRange(ci.week_start_date)}</span>
                <span className={`text-sm font-bold ${complianceColor(ci.compliance_pct)}`}>{ci.compliance_pct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="max-w-xs truncate text-xs text-gray-400">{ci.ai_summary.slice(0, 80)}...</span>
                <span className="text-gray-400">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3 space-y-3">
                <p className="text-sm leading-relaxed text-gray-700">{ci.ai_summary}</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  {ci.avg_calories !== null && <span>Cal: {ci.avg_calories}</span>}
                  {ci.avg_protein !== null && <span>Protein: {ci.avg_protein}g</span>}
                  {ci.avg_sleep_hours !== null && <span>Sleep: {ci.avg_sleep_hours}h</span>}
                  {ci.avg_hrv !== null && <span>HRV: {ci.avg_hrv}</span>}
                </div>
                {ci.risk_flags && ci.risk_flags.length > 0 && (
                  <div className="space-y-1">
                    {ci.risk_flags.map((flag, i) => (
                      <p key={i} className="text-xs text-red-600">⚠ {flag}</p>
                    ))}
                  </div>
                )}
                {ci.adjustments && ci.adjustments.length > 0 && (
                  <div className="space-y-1">
                    {ci.adjustments.map((adj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{adj.type}</span>
                        <span className="text-xs text-gray-600">{adj.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- __tests__/components/review/`
Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/review/ __tests__/components/review/
git commit -m "feat: add review UI components (stat cards, week summary, check-in history)"
```

---

## Task 4: Rewrite Review Page

**Files:**
- Modify: `src/app/dashboard/review/page.tsx`

- [ ] **Step 1: Read existing file, then replace entirely with:**

```tsx
// src/app/dashboard/review/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { WeekSummary } from "@/components/review/week-summary";
import { CheckInHistory } from "@/components/review/check-in-history";

interface CheckIn {
  id: string;
  week_start_date: string;
  compliance_pct: number;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_sleep_hours: number | null;
  avg_hrv: number | null;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Array<{ type: string; description: string; affected_days: number[] }> | null;
  user_approved: boolean | null;
  created_at: string;
}

export default function ReviewPage() {
  const [current, setCurrent] = useState<CheckIn | null>(null);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/review");
    if (res.ok) {
      const data = await res.json();
      setCurrent(data.current);
      setHistory(data.history);
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
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Weekly Review</h1>
      <WeekSummary checkIn={current} />
      <CheckInHistory history={history} />
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/review/page.tsx
git commit -m "feat: rewrite weekly review page with AI summary and historical check-ins"
```

---

## Task 5: Google Calendar OAuth Routes

**Files:**
- Create: `src/app/api/integrations/google-calendar/authorize/route.ts`
- Create: `src/app/api/integrations/google-calendar/callback/route.ts`

- [ ] **Step 1: Create authorize route**

```typescript
// src/app/api/integrations/google-calendar/authorize/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state: userId,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
```

- [ ] **Step 2: Create callback route**

```typescript
// src/app/api/integrations/google-calendar/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google_calendar=error&reason=denied", request.url),
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google_calendar=error&reason=token_exchange", request.url),
    );
  }

  const tokenData = await tokenRes.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

  const { error: dbError } = await supabase
    .from("integrations")
    .upsert(
      {
        user_id: state,
        provider: "google_calendar",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        credentials: { expires_at: expiresAt },
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );

  if (dbError) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?google_calendar=error&reason=db", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/dashboard/settings?google_calendar=success", request.url),
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/integrations/google-calendar/
git commit -m "feat: add Google Calendar OAuth authorize and callback routes"
```

---

## Task 6: Google Calendar Client

**Files:**
- Create: `src/lib/google-calendar.ts`
- Test: `__tests__/lib/google-calendar.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// __tests__/lib/google-calendar.test.ts
import { describe, it, expect } from "vitest";
import { parseAvailableSlots } from "@/lib/google-calendar";

describe("google-calendar", () => {
  describe("parseAvailableSlots", () => {
    it("identifies free slots between events", () => {
      const events = [
        { start: "2026-05-04T09:00:00Z", end: "2026-05-04T10:00:00Z", summary: "Meeting" },
        { start: "2026-05-04T14:00:00Z", end: "2026-05-04T15:30:00Z", summary: "Call" },
      ];

      const slots = parseAvailableSlots(events, "2026-05-04", 5, 21); // 5am-9pm
      // Should have: 5-9am, 10am-2pm, 3:30pm-9pm
      expect(slots.length).toBeGreaterThanOrEqual(3);
      expect(slots[0].start).toContain("05:00");
    });

    it("returns full day when no events", () => {
      const slots = parseAvailableSlots([], "2026-05-04", 5, 21);
      expect(slots).toHaveLength(1);
      expect(slots[0].start).toContain("05:00");
      expect(slots[0].end).toContain("21:00");
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL. Then implement:**

```typescript
// src/lib/google-calendar.ts
import { createClient } from "@supabase/supabase-js";

interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
}

interface TimeSlot {
  start: string; // ISO datetime
  end: string;
  durationMinutes: number;
}

export function parseAvailableSlots(
  events: CalendarEvent[],
  dateStr: string,
  startHour: number,
  endHour: number,
): TimeSlot[] {
  const dayStart = new Date(`${dateStr}T${String(startHour).padStart(2, "0")}:00:00Z`);
  const dayEnd = new Date(`${dateStr}T${String(endHour).padStart(2, "0")}:00:00Z`);

  // Sort events by start time
  const sorted = events
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end) }))
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: TimeSlot[] = [];
  let cursor = dayStart;

  for (const event of sorted) {
    if (event.start > cursor) {
      const durationMs = event.start.getTime() - cursor.getTime();
      if (durationMs >= 30 * 60 * 1000) { // At least 30 min
        slots.push({
          start: cursor.toISOString(),
          end: event.start.toISOString(),
          durationMinutes: Math.round(durationMs / 60000),
        });
      }
    }
    if (event.end > cursor) cursor = event.end;
  }

  // Remaining time after last event
  if (cursor < dayEnd) {
    const durationMs = dayEnd.getTime() - cursor.getTime();
    if (durationMs >= 30 * 60 * 1000) {
      slots.push({
        start: cursor.toISOString(),
        end: dayEnd.toISOString(),
        durationMinutes: Math.round(durationMs / 60000),
      });
    }
  }

  return slots;
}

async function refreshGoogleToken(userId: string): Promise<string> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, credentials")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .single();

  if (!integration) throw new Error("No Google Calendar integration");

  const expiresAt = (integration.credentials as { expires_at?: number })?.expires_at ?? 0;

  // Refresh if expiring within 5 minutes
  if (Date.now() / 1000 > expiresAt - 300) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: integration.refresh_token!,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Google token refresh failed");

    const data = await res.json();
    const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    await supabase
      .from("integrations")
      .update({
        access_token: data.access_token,
        credentials: { expires_at: newExpiresAt },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google_calendar");

    return data.access_token;
  }

  return integration.access_token!;
}

export async function getCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const token = await refreshGoogleToken(userId);

  const params = new URLSearchParams({
    timeMin: `${startDate}T00:00:00Z`,
    timeMax: `${endDate}T23:59:59Z`,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Google Calendar API failed: ${res.status}`);

  const data = await res.json();
  return (data.items || []).map((item: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; summary?: string }) => ({
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    summary: item.summary || "",
  }));
}

export async function createCalendarEvent(
  userId: string,
  summary: string,
  description: string,
  startTime: string,
  durationMinutes: number,
): Promise<string> {
  const token = await refreshGoogleToken(userId);

  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      }),
    },
  );

  if (!res.ok) throw new Error(`Failed to create calendar event: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const token = await refreshGoogleToken(userId);

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- __tests__/lib/google-calendar.test.ts`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/google-calendar.ts __tests__/lib/google-calendar.test.ts
git commit -m "feat: add Google Calendar client with availability parsing and event management"
```

---

## Task 7: Calendar Sync API Route

**Files:**
- Create: `src/app/api/plan/calendar-sync/route.ts`

- [ ] **Step 1: Create calendar sync route**

```typescript
// src/app/api/plan/calendar-sync/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Check if user has Google Calendar connected
  const { data: gcal } = await supabase
    .from("integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .eq("status", "active")
    .single();

  if (!gcal) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  // Get active plan's approved workouts that don't have calendar events yet
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) {
    return NextResponse.json({ error: "No active plan" }, { status: 400 });
  }

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, date, session_type, scheduled_time, calendar_event_id")
    .eq("plan_id", plan.id)
    .eq("approved", true)
    .is("calendar_event_id", null)
    .neq("session_type", "Rest")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date");

  if (!workouts || workouts.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  let synced = 0;

  for (const workout of workouts) {
    try {
      // Use scheduled_time if available, otherwise default to 7 AM on the date
      const startTime = workout.scheduled_time || `${workout.date}T07:00:00Z`;

      const eventId = await createCalendarEvent(
        userId,
        `[Hybro] ${workout.session_type}`,
        "AI-suggested session. Log your workout in Hevy/Strava.",
        startTime,
        75, // 75 min default duration
      );

      await supabase
        .from("planned_workouts")
        .update({ calendar_event_id: eventId })
        .eq("id", workout.id);

      synced++;
    } catch (err) {
      console.error(`Failed to create calendar event for ${workout.date}:`, err);
    }
  }

  return NextResponse.json({ synced });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/plan/calendar-sync/route.ts
git commit -m "feat: add calendar sync API route for pushing plan to Google Calendar"
```

---

## Task 8: Update Settings + Status for Google Calendar

**Files:**
- Modify: `src/app/api/integrations/status/route.ts`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Update status route to include google_calendar**

Read `src/app/api/integrations/status/route.ts` and change the providers array from:
```typescript
const providers = ["macrofactor", "hevy", "strava", "garmin"];
```
to:
```typescript
const providers = ["macrofactor", "hevy", "strava", "garmin", "google_calendar"];
```

- [ ] **Step 2: Update Settings page**

Read `src/app/dashboard/settings/page.tsx` and add Google Calendar to the INTEGRATIONS array:

Change from:
```typescript
const INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
] as const;
```
to:
```typescript
const INTEGRATIONS = [
  { provider: "macrofactor", name: "MacroFactor", description: "Nutrition tracking & macros", type: "credentials" },
  { provider: "hevy", name: "Hevy", description: "Strength training & workouts", type: "api-key" },
  { provider: "strava", name: "Strava", description: "Running, cycling & swimming", type: "oauth" },
  { provider: "garmin", name: "Garmin", description: "Recovery, sleep & HRV", type: "credentials" },
  { provider: "google_calendar", name: "Google Calendar", description: "Sync training schedule to your calendar", type: "oauth" },
] as const;
```

Also update the `handleConnect` function to handle google_calendar OAuth. Find:
```typescript
  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      window.location.href = "/api/integrations/strava/authorize";
```
and change to:
```typescript
  const handleConnect = (provider: string, type: string) => {
    if (type === "oauth") {
      if (provider === "google_calendar") {
        window.location.href = "/api/integrations/google-calendar/authorize";
      } else {
        window.location.href = "/api/integrations/strava/authorize";
      }
```

Also add Google Calendar OAuth redirect detection in the useEffect. After the strava check:
```typescript
    if (params.get("google_calendar") === "success") {
      setToastMessage("Google Calendar connected successfully!");
      window.history.replaceState({}, "", "/dashboard/settings");
    } else if (params.get("google_calendar") === "error") {
      setToastMessage("Failed to connect Google Calendar. Please try again.");
      window.history.replaceState({}, "", "/dashboard/settings");
    }
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/integrations/status/route.ts src/app/dashboard/settings/page.tsx
git commit -m "feat: add Google Calendar to settings and integration status"
```

---

## Task 9: Server-Side Calendar Client + Reschedule Detection

**Files:**
- Create: `server/src/integrations/google-calendar-client.ts`
- Modify: `server/src/config.ts`
- Modify: `server/.env.example`
- Modify: `server/src/sync/scheduler.ts`
- Test: `server/__tests__/integrations/google-calendar-client.test.ts`

- [ ] **Step 1: Write test**

```typescript
// server/__tests__/integrations/google-calendar-client.test.ts
import { describe, it, expect, vi } from "vitest";
import { detectReschedules } from "../../src/integrations/google-calendar-client.js";

vi.mock("../../src/db.js", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("../../src/config.js", () => ({
  config: { googleClientId: "test", googleClientSecret: "test" },
}));

describe("google-calendar-client", () => {
  describe("detectReschedules", () => {
    it("detects when a calendar event was moved", () => {
      const calendarEvents = [
        { id: "evt-1", start: "2026-05-04T08:00:00Z", end: "2026-05-04T09:15:00Z", summary: "[Hybro] Push" },
      ];
      const plannedWorkouts = [
        { id: "pw-1", calendar_event_id: "evt-1", scheduled_time: "2026-05-04T07:00:00Z", session_type: "Push" },
      ];

      const reschedules = detectReschedules(calendarEvents, plannedWorkouts);
      expect(reschedules).toHaveLength(1);
      expect(reschedules[0].workoutId).toBe("pw-1");
      expect(reschedules[0].newTime).toBe("2026-05-04T08:00:00Z");
    });

    it("returns empty when no changes", () => {
      const calendarEvents = [
        { id: "evt-1", start: "2026-05-04T07:00:00Z", end: "2026-05-04T08:15:00Z", summary: "[Hybro] Push" },
      ];
      const plannedWorkouts = [
        { id: "pw-1", calendar_event_id: "evt-1", scheduled_time: "2026-05-04T07:00:00Z", session_type: "Push" },
      ];

      const reschedules = detectReschedules(calendarEvents, plannedWorkouts);
      expect(reschedules).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL. Then implement:**

```typescript
// server/src/integrations/google-calendar-client.ts
import { supabase } from "../db.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

interface CalendarEvent {
  id: string;
  start: string;
  end: string;
  summary: string;
}

interface PlannedWorkout {
  id: string;
  calendar_event_id: string;
  scheduled_time: string;
  session_type: string;
}

interface Reschedule {
  workoutId: string;
  eventId: string;
  oldTime: string;
  newTime: string;
}

export function detectReschedules(
  calendarEvents: CalendarEvent[],
  plannedWorkouts: PlannedWorkout[],
): Reschedule[] {
  const reschedules: Reschedule[] = [];

  const eventMap = new Map(calendarEvents.map((e) => [e.id, e]));

  for (const workout of plannedWorkouts) {
    if (!workout.calendar_event_id || !workout.scheduled_time) continue;

    const event = eventMap.get(workout.calendar_event_id);
    if (!event) continue;

    // Compare start times (ignore seconds)
    const eventStart = new Date(event.start).toISOString();
    const workoutStart = new Date(workout.scheduled_time).toISOString();

    if (eventStart !== workoutStart) {
      reschedules.push({
        workoutId: workout.id,
        eventId: workout.calendar_event_id,
        oldTime: workoutStart,
        newTime: eventStart,
      });
    }
  }

  return reschedules;
}

async function refreshGoogleToken(userId: string): Promise<string> {
  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, credentials")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .single();

  if (!integration) throw new Error("No Google Calendar integration");

  const expiresAt = (integration.credentials as { expires_at?: number })?.expires_at ?? 0;

  if (Date.now() / 1000 > expiresAt - 300) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        refresh_token: integration.refresh_token!,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) throw new Error("Google token refresh failed");
    const data = await res.json();
    const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    await supabase
      .from("integrations")
      .update({
        access_token: data.access_token,
        credentials: { expires_at: newExpiresAt },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("provider", "google_calendar");

    return data.access_token;
  }

  return integration.access_token!;
}

export async function fetchCalendarEvents(userId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const token = await refreshGoogleToken(userId);

  const params = new URLSearchParams({
    timeMin: `${startDate}T00:00:00Z`,
    timeMax: `${endDate}T23:59:59Z`,
    singleEvents: "true",
    orderBy: "startTime",
    q: "[Hybro]", // Only fetch our events
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) throw new Error(`Google Calendar API failed: ${res.status}`);

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    summary: item.summary || "",
  }));
}

export async function checkForReschedules(userId: string, planId: string): Promise<Reschedule[]> {
  // Get this week's date range
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startStr = monday.toISOString().slice(0, 10);
  const endStr = sunday.toISOString().slice(0, 10);

  // Fetch calendar events
  const calendarEvents = await fetchCalendarEvents(userId, startStr, endStr);

  // Fetch planned workouts with calendar event IDs
  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, calendar_event_id, scheduled_time, session_type")
    .eq("plan_id", planId)
    .not("calendar_event_id", "is", null)
    .gte("date", startStr)
    .lte("date", endStr);

  if (!workouts || workouts.length === 0) return [];

  const reschedules = detectReschedules(calendarEvents, workouts as PlannedWorkout[]);

  // Apply reschedules to DB
  for (const r of reschedules) {
    await supabase
      .from("planned_workouts")
      .update({ scheduled_time: r.newTime })
      .eq("id", r.workoutId);

    logger.info("Calendar reschedule detected", { workoutId: r.workoutId, oldTime: r.oldTime, newTime: r.newTime });
  }

  return reschedules;
}
```

- [ ] **Step 3: Add Google config to server**

Read `server/src/config.ts` and add:
```typescript
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
```

These are optional (not `required()`) because not all users will have Google Calendar.

Read `server/.env.example` and add:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 4: Add reschedule check to Sunday cron**

Read `server/src/sync/scheduler.ts` and add this import at the top:
```typescript
import { checkForReschedules } from "../integrations/google-calendar-client.js";
```

Add a new cron right before the weekly check-in cron (Sunday 8:30 PM, 30 min before check-ins):
```typescript
  // Calendar reschedule detection: Sunday 8:30 PM UTC (before weekly check-in)
  cron.schedule("30 20 * * 0", async () => {
    logger.info("Cron: checking for calendar reschedules");
    try {
      const { data: plans } = await supabase
        .from("training_plans")
        .select("id, user_id")
        .eq("status", "active");

      if (!plans) return;

      for (const plan of plans) {
        // Check if user has Google Calendar connected
        const { data: gcal } = await supabase
          .from("integrations")
          .select("id")
          .eq("user_id", plan.user_id)
          .eq("provider", "google_calendar")
          .eq("status", "active")
          .single();

        if (gcal) {
          await checkForReschedules(plan.user_id, plan.id).catch((err) =>
            logger.error("Reschedule check failed", { userId: plan.user_id, error: String(err) }),
          );
        }
      }
    } catch (err) {
      logger.error("Cron: reschedule check failed", { error: String(err) });
    }
  });
```

You'll also need to import `supabase` from `../db.js` in the scheduler file. Check if it's already imported — if not, add it.

- [ ] **Step 5: Run server tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add server/src/integrations/google-calendar-client.ts server/__tests__/integrations/google-calendar-client.test.ts server/src/config.ts server/.env.example server/src/sync/scheduler.ts
git commit -m "feat: add server-side Google Calendar client with reschedule detection"
```

---

## Task 10: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 2: Run all server tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run`
Expected: All PASS

- [ ] **Step 3: Verify git status**

Run: `git status`
Expected: Clean

- [ ] **Step 4: Final commit if needed**

```bash
git add -A && git commit -m "chore: Phase 6 cleanup" || echo "Nothing to commit"
```
