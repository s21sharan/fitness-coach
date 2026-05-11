# AI Training Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show AI-generated training plans on the calendar as greyed-out future workouts with targets, add compliance badges to past days, and enable the AI coach to generate/adjust plans via chat.

**Architecture:** New `targets` JSONB column on `planned_workouts`. New `/api/plan/upcoming` endpoint feeds planned workouts to the calendar. Enhanced plan generation prompt includes recent activity data for data-driven targets. Coach page gets tool-use integration for plan CRUD. Sunday cron generates rolling 2-week plans.

**Tech Stack:** Next.js App Router, Supabase, Vercel AI SDK (Claude Sonnet), TypeScript

---

### Task 1: Database Migration — Add `targets` Column

**Files:**
- Create: `supabase/migrations/004_plan_targets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 004_plan_targets.sql
-- Add targets JSONB column to planned_workouts for AI-generated workout targets
ALTER TABLE public.planned_workouts ADD COLUMN IF NOT EXISTS targets jsonb;

COMMENT ON COLUMN public.planned_workouts.targets IS 'AI-generated workout targets: distance, pace, duration, HR zone, muscle focus';
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_plan_targets.sql
git commit -m "feat: add targets JSONB column to planned_workouts"
```

---

### Task 2: Extend Plan Generation Schema with Targets

**Files:**
- Modify: `src/lib/training/schemas.ts`
- Test: `__tests__/lib/training/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/training/schemas.test.ts
import { describe, it, expect } from "vitest";
import { dayLayoutSchema, planGenerationSchema } from "@/lib/training/schemas";

describe("dayLayoutSchema", () => {
  it("accepts a day layout with targets", () => {
    const result = dayLayoutSchema.safeParse({
      day_of_week: 1,
      session_type: "Easy Run (Zone 2)",
      ai_notes: "Keep HR under 145",
      targets: {
        target_distance_km: 8.0,
        target_duration_min: 48,
        target_pace_min_km: 5.8,
        target_hr_zone: 2,
        target_hr_max: 145,
        muscle_focus: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a day layout without targets", () => {
    const result = dayLayoutSchema.safeParse({
      day_of_week: 0,
      session_type: "Rest",
      ai_notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a lifting day with muscle_focus", () => {
    const result = dayLayoutSchema.safeParse({
      day_of_week: 0,
      session_type: "Push",
      ai_notes: "Progressive overload on bench",
      targets: {
        target_distance_km: null,
        target_duration_min: 55,
        target_pace_min_km: null,
        target_hr_zone: null,
        target_hr_max: null,
        muscle_focus: "Chest/Shoulders/Triceps",
      },
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/training/schemas.test.ts`
Expected: FAIL — `targets` key not recognized by schema.

- [ ] **Step 3: Update the schema**

In `src/lib/training/schemas.ts`, replace the `dayLayoutSchema` (lines 16-20) with:

```typescript
const workoutTargetsSchema = z.object({
  target_distance_km: z.number().nullable().optional(),
  target_duration_min: z.number().nullable().optional(),
  target_pace_min_km: z.number().nullable().optional(),
  target_hr_zone: z.number().int().min(1).max(5).nullable().optional(),
  target_hr_max: z.number().int().nullable().optional(),
  muscle_focus: z.string().nullable().optional(),
});

const dayLayoutSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_type: z.string().min(1),
  ai_notes: z.string().nullable(),
  targets: workoutTargetsSchema.optional(),
});
```

Export the new types:

```typescript
export type WorkoutTargets = z.infer<typeof workoutTargetsSchema>;
export { workoutTargetsSchema };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/training/schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/schemas.ts __tests__/lib/training/schemas.test.ts
git commit -m "feat: add workout targets to plan generation schema"
```

---

### Task 3: Enhance Plan Generation Prompt with Activity Data

**Files:**
- Modify: `src/lib/training/prompts.ts`
- Modify: `src/lib/training/generate-plan.ts`
- Test: `__tests__/lib/training/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/training/prompts.test.ts
import { describe, it, expect } from "vitest";
import { buildUserPrompt } from "@/lib/training/prompts";

describe("buildUserPrompt", () => {
  it("includes recent activity data when provided", () => {
    const prompt = buildUserPrompt({
      age: 30,
      sex: "male",
      height: 180,
      weight: 80,
      experience: "intermediate",
      goal: "Build muscle and maintain running base",
      emphasis: "chest",
      daysPerWeek: 5,
      liftingDays: 3,
      racePlan: null,
      cardioTypes: ["running"],
      recentActivity: {
        avgRunPaceMinKm: 5.4,
        avgRunDistanceKm: 7.2,
        avgRunHr: 155,
        weeklyRunCount: 2.5,
        weeklyLiftCount: 3,
        avgLiftDurationMin: 55,
        avgHrv: 48,
        avgSleepHours: 7.5,
      },
    });
    expect(prompt).toContain("5.4");
    expect(prompt).toContain("7.2");
    expect(prompt).toContain("155");
    expect(prompt).toContain("HRV");
  });

  it("works without recent activity data", () => {
    const prompt = buildUserPrompt({
      age: 25,
      sex: "female",
      height: 165,
      weight: 60,
      experience: "beginner",
      goal: "Lose weight",
      emphasis: null,
      daysPerWeek: 4,
      liftingDays: 3,
      racePlan: null,
      cardioTypes: null,
      recentActivity: null,
    });
    expect(prompt).not.toContain("Recent activity");
    expect(prompt).toContain("beginner");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/training/prompts.test.ts`
Expected: FAIL — `recentActivity` not in the function's context type.

- [ ] **Step 3: Add `recentActivity` to the prompt builder**

In `src/lib/training/prompts.ts`, add the `RecentActivity` type and extend `UserContext`:

```typescript
export interface RecentActivity {
  avgRunPaceMinKm: number | null;
  avgRunDistanceKm: number | null;
  avgRunHr: number | null;
  weeklyRunCount: number;
  weeklyLiftCount: number;
  avgLiftDurationMin: number | null;
  avgHrv: number | null;
  avgSleepHours: number | null;
}
```

Add `recentActivity: RecentActivity | null` to `UserContext` interface.

At the end of `buildUserPrompt()`, before returning, add:

```typescript
if (ctx.recentActivity) {
  const a = ctx.recentActivity;
  parts.push("\nRecent activity data (last 30 days):");
  if (a.avgRunPaceMinKm) parts.push(`- Avg easy run pace: ${a.avgRunPaceMinKm} min/km`);
  if (a.avgRunDistanceKm) parts.push(`- Avg run distance: ${a.avgRunDistanceKm} km`);
  if (a.avgRunHr) parts.push(`- Avg run HR: ${a.avgRunHr} bpm`);
  parts.push(`- Weekly runs: ${a.weeklyRunCount}, weekly lifts: ${a.weeklyLiftCount}`);
  if (a.avgLiftDurationMin) parts.push(`- Avg lifting session: ${a.avgLiftDurationMin} min`);
  if (a.avgHrv) parts.push(`- Avg HRV: ${a.avgHrv}`);
  if (a.avgSleepHours) parts.push(`- Avg sleep: ${a.avgSleepHours}h`);
  parts.push("\nUse this data to set realistic pace, distance, and duration targets for each workout.");
}
```

- [ ] **Step 4: Update the system prompt**

In `src/lib/training/prompts.ts`, add to `PLAN_SYSTEM_PROMPT` after the session type examples:

```
When setting targets for each day, use the athlete's recent data to set realistic goals:
- For runs: set target_distance_km, target_pace_min_km, target_hr_zone, target_hr_max based on their recent averages
- For lifting: set target_duration_min and muscle_focus
- For rest days: targets can be omitted
- Zone 2 runs should target a pace ~10-15% slower than their average pace
- Long runs should target 1.5-2x their average distance at easy pace
- Tempo runs should target their average pace or slightly faster
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/training/prompts.test.ts`
Expected: PASS

- [ ] **Step 6: Update `generateTrainingPlan` to store targets**

In `src/lib/training/generate-plan.ts`, update the workout row construction (around line 130) to include targets:

```typescript
const workoutRows = [];
for (let week = 0; week < 4; week++) {
  for (const day of plan.weekly_layout) {
    const date = addDays(startDate, week * 7 + day.day_of_week);
    workoutRows.push({
      plan_id: planId,
      date: date.toISOString().slice(0, 10),
      day_of_week: day.day_of_week,
      session_type: day.session_type,
      ai_notes: day.ai_notes,
      targets: day.targets || null,
      approved: week === 0,
    });
  }
}
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/training/prompts.ts src/lib/training/generate-plan.ts __tests__/lib/training/prompts.test.ts
git commit -m "feat: enhance plan generation with activity data and workout targets"
```

---

### Task 4: `/api/plan/upcoming` Endpoint

**Files:**
- Create: `src/app/api/plan/upcoming/route.ts`
- Test: `__tests__/api/plan-upcoming.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/plan-upcoming.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "user_test" })),
}));

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe("GET /api/plan/upcoming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns planned workouts for the next 14 days", async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "plan_1" }, error: null });
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: "w1", date: "2026-05-12", session_type: "Push", ai_notes: null, targets: null, approved: true },
      ],
      error: null,
    });

    const { GET } = await import("@/app/api/plan/upcoming/route");
    const res = await GET();
    const json = await res.json();

    expect(json.workouts).toHaveLength(1);
    expect(json.workouts[0].session_type).toBe("Push");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/plan-upcoming.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the endpoint**

```typescript
// src/app/api/plan/upcoming/route.ts
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

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) return NextResponse.json({ workouts: [] });

  const today = new Date().toISOString().slice(0, 10);
  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);
  const endStr = in14Days.toISOString().slice(0, 10);

  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("id, date, day_of_week, session_type, ai_notes, targets, approved, status")
    .eq("plan_id", plan.id)
    .gte("date", today)
    .lte("date", endStr)
    .order("date");

  return NextResponse.json({ workouts: workouts || [] });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/plan-upcoming.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/plan/upcoming/route.ts __tests__/api/plan-upcoming.test.ts
git commit -m "feat: add /api/plan/upcoming endpoint for calendar planned workouts"
```

---

### Task 5: Planned Workout Card Component

**Files:**
- Create: `src/components/calendar/planned-card.tsx`
- Test: `__tests__/components/calendar/planned-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/calendar/planned-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlannedCard } from "@/components/calendar/planned-card";

describe("PlannedCard", () => {
  it("renders a planned run with targets", () => {
    render(
      <PlannedCard
        sessionType="Easy Run (Zone 2)"
        aiNotes="Keep HR under 145"
        targets={{
          target_distance_km: 8.0,
          target_duration_min: 48,
          target_pace_min_km: 5.8,
          target_hr_zone: 2,
          target_hr_max: 145,
          muscle_focus: null,
        }}
      />,
    );
    expect(screen.getByText(/Easy Run/)).toBeDefined();
    expect(screen.getByText(/8/)).toBeDefined();
    expect(screen.getByText(/Z2/)).toBeDefined();
    expect(screen.getByText("Planned")).toBeDefined();
  });

  it("renders a planned lifting session with muscle focus", () => {
    render(
      <PlannedCard
        sessionType="Push"
        aiNotes="Progressive overload"
        targets={{
          target_duration_min: 55,
          muscle_focus: "Chest/Shoulders/Triceps",
        }}
      />,
    );
    expect(screen.getByText(/Push/)).toBeDefined();
    expect(screen.getByText(/Chest/)).toBeDefined();
    expect(screen.getByText(/55/)).toBeDefined();
  });

  it("renders a rest day", () => {
    render(<PlannedCard sessionType="Rest" aiNotes={null} targets={null} />);
    expect(screen.getByText(/Rest/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/calendar/planned-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```typescript
// src/components/calendar/planned-card.tsx
"use client";

interface WorkoutTargets {
  target_distance_km?: number | null;
  target_duration_min?: number | null;
  target_pace_min_km?: number | null;
  target_hr_zone?: number | null;
  target_hr_max?: number | null;
  muscle_focus?: string | null;
}

interface PlannedCardProps {
  sessionType: string;
  aiNotes: string | null;
  targets: WorkoutTargets | null;
}

function isCardio(s: string): boolean {
  return /run|jog|bike|ride|cycling|swim|pool/i.test(s);
}

function isRest(s: string): boolean {
  return /rest|recovery|off/i.test(s);
}

function cardioIcon(s: string): string {
  if (/run|jog/i.test(s)) return "🏃";
  if (/bike|ride|cycling/i.test(s)) return "🚴";
  if (/swim|pool/i.test(s)) return "🏊";
  return "⚡";
}

function fmtPace(p: number): string {
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function PlannedCard({ sessionType, aiNotes, targets }: PlannedCardProps) {
  const rest = isRest(sessionType);
  const cardio = isCardio(sessionType);
  const icon = rest ? "😴" : cardio ? cardioIcon(sessionType) : "🏋️";
  const t = targets || {};

  return (
    <div
      style={{
        opacity: 0.55,
        borderLeft: "3px dashed #9ca3af",
        borderRadius: 5,
        padding: "6px 8px",
        fontSize: 10,
        lineHeight: 1.5,
        background: "#f9fafb",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontWeight: 700, color: "#374151", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sessionType}
        </span>
      </div>

      {/* Targets */}
      {!rest && (
        <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "0 6px" }}>
          {t.target_distance_km != null && (
            <span style={{ fontWeight: 700, color: "#374151" }}>{t.target_distance_km} km</span>
          )}
          {t.target_duration_min != null && (
            <span>{t.target_duration_min}min</span>
          )}
          {t.target_pace_min_km != null && (
            <span>{fmtPace(t.target_pace_min_km)}</span>
          )}
          {t.target_hr_zone != null && (
            <span style={{ fontWeight: 700, color: "#6366f1" }}>Z{t.target_hr_zone}</span>
          )}
          {t.muscle_focus != null && (
            <span style={{ color: "#854d0e" }}>{t.muscle_focus}</span>
          )}
        </div>
      )}

      {/* AI Notes */}
      {aiNotes && (
        <div style={{ color: "#9ca3af", fontSize: 9, marginTop: 3, lineHeight: 1.4, fontStyle: "italic" }}>
          {aiNotes}
        </div>
      )}

      {/* Planned tag */}
      <div style={{ marginTop: 3 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", background: "#f3f4f6", borderRadius: 3, padding: "1px 4px" }}>
          Planned
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/calendar/planned-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/planned-card.tsx __tests__/components/calendar/planned-card.test.tsx
git commit -m "feat: add PlannedCard component for greyed-out future workouts"
```

---

### Task 6: Compliance Badge Component

**Files:**
- Create: `src/components/calendar/compliance-badge.tsx`
- Test: `__tests__/components/calendar/compliance-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/calendar/compliance-badge.test.tsx
import { describe, it, expect } from "vitest";
import { getComplianceStatus } from "@/components/calendar/compliance-badge";

describe("getComplianceStatus", () => {
  it("returns green when planned lift matches actual workout", () => {
    expect(getComplianceStatus("Push", [{ name: "Push Day" }], [])).toBe("match");
  });

  it("returns green when planned run matches actual cardio", () => {
    expect(getComplianceStatus("Easy Run (Zone 2)", [], [{ type: "run" }])).toBe("match");
  });

  it("returns orange when activity exists but wrong type", () => {
    expect(getComplianceStatus("Push", [], [{ type: "run" }])).toBe("different");
  });

  it("returns red when planned session has no activity", () => {
    expect(getComplianceStatus("Push", [], [])).toBe("missed");
  });

  it("returns green for rest day with no activity", () => {
    expect(getComplianceStatus("Rest", [], [])).toBe("match");
  });

  it("returns green for rest day even with activity (bonus)", () => {
    expect(getComplianceStatus("Rest", [{ name: "Workout" }], [])).toBe("match");
  });

  it("returns null when no plan for that day", () => {
    expect(getComplianceStatus(null, [], [])).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/calendar/compliance-badge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement compliance logic and badge**

```typescript
// src/components/calendar/compliance-badge.tsx
"use client";

type ComplianceStatus = "match" | "different" | "missed" | null;

const CARDIO_KEYWORDS = /run|jog|bike|ride|cycling|swim|pool/i;
const LIFT_KEYWORDS = /push|pull|legs|upper|lower|full.body|arms|shoulders|back|chest/i;
const REST_KEYWORDS = /rest|recovery|off/i;

export function getComplianceStatus(
  plannedSessionType: string | null,
  workouts: { name?: string }[],
  cardio: { type?: string }[],
): ComplianceStatus {
  if (!plannedSessionType) return null;

  if (REST_KEYWORDS.test(plannedSessionType)) return "match";

  const hasWorkout = workouts.length > 0;
  const hasCardio = cardio.length > 0;

  if (!hasWorkout && !hasCardio) return "missed";

  const planIsCardio = CARDIO_KEYWORDS.test(plannedSessionType);
  const planIsLift = LIFT_KEYWORDS.test(plannedSessionType);

  if (planIsCardio) {
    const planType = /run|jog/i.test(plannedSessionType) ? "run" : /bike|ride|cycling/i.test(plannedSessionType) ? "bike" : /swim|pool/i.test(plannedSessionType) ? "swim" : null;
    if (planType && cardio.some((c) => c.type === planType)) return "match";
    if (hasCardio || hasWorkout) return "different";
    return "missed";
  }

  if (planIsLift) {
    if (hasWorkout) return "match";
    if (hasCardio) return "different";
    return "missed";
  }

  if (hasWorkout || hasCardio) return "match";
  return "missed";
}

const BADGE_COLORS: Record<string, string> = {
  match: "#22c55e",
  different: "#f97316",
  missed: "#ef4444",
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  if (!status) return null;
  return (
    <span
      title={status === "match" ? "Completed as planned" : status === "different" ? "Different activity" : "Missed"}
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: BADGE_COLORS[status],
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/calendar/compliance-badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/compliance-badge.tsx __tests__/components/calendar/compliance-badge.test.tsx
git commit -m "feat: add compliance badge with matching logic"
```

---

### Task 7: Wire Planned Workouts and Compliance into Calendar

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add PlannedWorkout interface and fetch**

At the top of `src/app/dashboard/page.tsx`, add the interface:

```typescript
interface PlannedWorkout {
  id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: {
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
  approved: boolean;
  status: string;
}
```

Add to `ApiData` interface: `planned: PlannedWorkout[];` (this will be fetched separately).

Add imports:

```typescript
import { PlannedCard } from "@/components/calendar/planned-card";
import { ComplianceBadge, getComplianceStatus } from "@/components/calendar/compliance-badge";
```

- [ ] **Step 2: Fetch planned workouts in the page component**

In `DashboardPage`, add a second fetch:

```typescript
const [planned, setPlanned] = useState<PlannedWorkout[]>([]);

useEffect(() => {
  fetch("/api/plan/upcoming").then((r) => r.json()).then((d) => setPlanned(d.workouts || [])).catch(() => {});
}, []);
```

- [ ] **Step 3: Add planned data to DayData and build functions**

Extend `DayData` interface:

```typescript
interface DayData {
  date: string;
  dateObj: Date;
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog | null;
  planned: PlannedWorkout | null; // add this
}
```

Update `buildMonthWeeks` to accept `planned` array and merge it:

```typescript
function buildMonthWeeks(firstMonday: Date, weekCount: number, data: ApiData, planned: PlannedWorkout[]): DayData[][] {
  const weeks: DayData[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekMonday = addDays(firstMonday, w * 7);
    const days: DayData[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekMonday, d);
      const ds = toDS(date);
      days.push({
        date: ds,
        dateObj: date,
        workouts: data.workouts.filter((x) => x.date === ds),
        cardio: data.cardio.filter((x) => x.date === ds),
        recovery: data.recovery.find((x) => x.date === ds) || null,
        planned: planned.find((p) => p.date === ds) || null,
      });
    }
    weeks.push(days);
  }
  return weeks;
}
```

Update the `weeks` useMemo call to pass `planned`.

- [ ] **Step 4: Update DayColumn to show planned cards and compliance badges**

Replace the `DayColumn` component:

```typescript
function DayColumn({ day, dayIndex }: { day: DayData; dayIndex: number }) {
  const today = toDS(new Date());
  const isToday = day.date === today;
  const isFuture = day.date > today;
  const isPast = day.date < today;
  const dayNum = day.dateObj.getDate();
  const hasActivity = day.workouts.length > 0 || day.cardio.length > 0;

  // Compliance badge for past days
  const compliance = isPast && day.planned
    ? getComplianceStatus(day.planned.session_type, day.workouts, day.cardio)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: (hasActivity || day.planned) ? 120 : 60, padding: "0 2px" }}>
      {/* Date header with compliance badge */}
      <div style={{ textAlign: "center", padding: "4px 0 2px", borderBottom: isToday ? "2px solid #3b82f6" : "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#fff" : "#374151", background: isToday ? "#3b82f6" : "transparent", width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{dayNum}</div>
        {compliance && <ComplianceBadge status={compliance} />}
      </div>

      {/* Recovery */}
      {day.recovery && <RecoveryBar r={day.recovery} />}

      {/* Actual activity cards (past + today) */}
      {day.workouts.map((w, i) => <WorkoutCard key={`w-${i}`} w={w} />)}
      {day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} />)}

      {/* Planned card (future days only) */}
      {isFuture && day.planned && (
        <PlannedCard
          sessionType={day.planned.session_type}
          aiNotes={day.planned.ai_notes}
          targets={day.planned.targets}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: show planned workouts on calendar with compliance badges"
```

---

### Task 8: `/api/plan/regenerate` Cron Endpoint

**Files:**
- Create: `src/app/api/plan/regenerate/route.ts`
- Modify: `src/lib/training/generate-plan.ts` (extract helper for fetching recent activity stats)

- [ ] **Step 1: Create helper to compute recent activity stats**

Add to `src/lib/training/generate-plan.ts`:

```typescript
export async function getRecentActivityStats(userId: string, supabase: ReturnType<typeof createClient>): Promise<RecentActivity | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().slice(0, 10);

  const [cardioRes, workoutRes, recoveryRes] = await Promise.all([
    supabase.from("cardio_logs").select("type, distance, duration, avg_hr").eq("user_id", userId).gte("date", since),
    supabase.from("workout_logs").select("duration_minutes").eq("user_id", userId).gte("date", since),
    supabase.from("recovery_logs").select("hrv, sleep_hours").eq("user_id", userId).gte("date", since),
  ]);

  const cardio = cardioRes.data || [];
  const workouts = workoutRes.data || [];
  const recovery = recoveryRes.data || [];

  const runs = cardio.filter((c) => c.type === "run");
  const weeks = 30 / 7;

  return {
    avgRunPaceMinKm: runs.length > 0 ? Math.round(runs.filter((r) => r.distance > 0).reduce((s, r) => s + r.duration / 60 / r.distance, 0) / runs.filter((r) => r.distance > 0).length * 10) / 10 : null,
    avgRunDistanceKm: runs.length > 0 ? Math.round(runs.reduce((s, r) => s + r.distance, 0) / runs.length * 10) / 10 : null,
    avgRunHr: runs.filter((r) => r.avg_hr).length > 0 ? Math.round(runs.filter((r) => r.avg_hr).reduce((s, r) => s + r.avg_hr!, 0) / runs.filter((r) => r.avg_hr).length) : null,
    weeklyRunCount: Math.round(runs.length / weeks * 10) / 10,
    weeklyLiftCount: Math.round(workouts.length / weeks * 10) / 10,
    avgLiftDurationMin: workouts.length > 0 ? Math.round(workouts.reduce((s, w) => s + (w.duration_minutes || 0), 0) / workouts.length) : null,
    avgHrv: recovery.filter((r) => r.hrv).length > 0 ? Math.round(recovery.filter((r) => r.hrv).reduce((s, r) => s + r.hrv!, 0) / recovery.filter((r) => r.hrv).length) : null,
    avgSleepHours: recovery.filter((r) => r.sleep_hours).length > 0 ? Math.round(recovery.filter((r) => r.sleep_hours).reduce((s, r) => s + r.sleep_hours!, 0) / recovery.filter((r) => r.sleep_hours).length * 10) / 10 : null,
  };
}
```

- [ ] **Step 2: Implement the cron endpoint**

```typescript
// src/app/api/plan/regenerate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { planGenerationSchema } from "@/lib/training/schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/training/prompts";
import { getRecentActivityStats } from "@/lib/training/generate-plan";

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all users with active plans
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, user_id, split_type, body_goal, race_type, plan_config")
    .eq("status", "active");

  if (!plans || plans.length === 0) {
    return NextResponse.json({ message: "No active plans" });
  }

  const results = [];

  for (const plan of plans) {
    try {
      // Get user profile and goals
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", plan.user_id).single(),
        supabase.from("user_goals").select("*").eq("user_id", plan.user_id).single(),
      ]);

      const profile = profileRes.data;
      const goals = goalsRes.data;
      if (!profile || !goals) continue;

      // Check what's already planned
      const nextMonday = new Date();
      const day = nextMonday.getDay();
      nextMonday.setDate(nextMonday.getDate() + (day === 0 ? 1 : 8 - day));
      const week2Monday = new Date(nextMonday);
      week2Monday.setDate(week2Monday.getDate() + 7);
      const week2Sunday = new Date(week2Monday);
      week2Sunday.setDate(week2Sunday.getDate() + 6);

      // Check if week 2 already has planned workouts
      const { data: existing } = await supabase
        .from("planned_workouts")
        .select("id")
        .eq("plan_id", plan.id)
        .gte("date", week2Monday.toISOString().slice(0, 10))
        .lte("date", week2Sunday.toISOString().slice(0, 10));

      if (existing && existing.length > 0) {
        results.push({ userId: plan.user_id, status: "skipped", reason: "week2 already planned" });
        continue;
      }

      // Get recent activity stats
      const recentActivity = await getRecentActivityStats(plan.user_id, supabase);

      // Generate new week via Claude
      const userPrompt = buildUserPrompt({
        age: profile.age,
        sex: profile.sex,
        height: profile.height,
        weight: profile.weight,
        experience: profile.training_experience,
        goal: goals.body_goal,
        emphasis: goals.emphasis,
        daysPerWeek: goals.days_per_week,
        liftingDays: goals.lifting_days,
        racePlan: goals.training_for_race ? {
          raceType: goals.race_type,
          raceDate: goals.race_date,
          goalTime: goals.goal_time,
        } : null,
        cardioTypes: goals.cardio_types,
        recentActivity,
      });

      const { object: newPlan } = await generateObject({
        model: anthropic("claude-sonnet-4-20250514"),
        schema: planGenerationSchema,
        system: PLAN_SYSTEM_PROMPT,
        prompt: userPrompt + "\n\nGenerate the plan for the upcoming week only (7 days).",
      });

      // Insert planned workouts for week 2
      const workoutRows = newPlan.weekly_layout.map((day) => ({
        plan_id: plan.id,
        date: new Date(week2Monday.getTime() + day.day_of_week * 86400000).toISOString().slice(0, 10),
        day_of_week: day.day_of_week,
        session_type: day.session_type,
        ai_notes: day.ai_notes,
        targets: day.targets || null,
        approved: false,
      }));

      await supabase.from("planned_workouts").insert(workoutRows);

      // Post coach message
      const { data: conversation } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", plan.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (conversation) {
        const summary = newPlan.weekly_layout
          .sort((a, b) => a.day_of_week - b.day_of_week)
          .map((d) => {
            const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            return `${dayNames[d.day_of_week]}: ${d.session_type}`;
          })
          .join("\n");

        await supabase.from("chat_messages").insert({
          conversation_id: conversation.id,
          role: "assistant",
          content: `I've planned your week of ${week2Monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${week2Sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Here's what I'm thinking:\n\n${summary}\n\nReview and approve when you're ready.`,
        });
      }

      results.push({ userId: plan.user_id, status: "generated", workouts: workoutRows.length });
    } catch (err) {
      results.push({ userId: plan.user_id, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plan/regenerate/route.ts src/lib/training/generate-plan.ts
git commit -m "feat: add /api/plan/regenerate cron endpoint for rolling 2-week plans"
```

---

### Task 9: `/api/plan/approve` and `/api/plan/edit` Endpoints

**Files:**
- Create: `src/app/api/plan/approve/route.ts`
- Create: `src/app/api/plan/edit/route.ts`

- [ ] **Step 1: Implement approve endpoint**

```typescript
// src/app/api/plan/approve/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekStart } = await req.json() as { weekStart: string };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) return NextResponse.json({ error: "No active plan" }, { status: 404 });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { error } = await supabase
    .from("planned_workouts")
    .update({ approved: true })
    .eq("plan_id", plan.id)
    .gte("date", weekStart)
    .lte("date", weekEnd.toISOString().slice(0, 10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "approved" });
}
```

- [ ] **Step 2: Implement edit endpoint**

```typescript
// src/app/api/plan/edit/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EditAction =
  | { action: "create"; date: string; session_type: string; ai_notes?: string; targets?: Record<string, unknown> }
  | { action: "update"; workout_id: string; session_type?: string; ai_notes?: string; targets?: Record<string, unknown> }
  | { action: "delete"; workout_id: string };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { edits } = await req.json() as { edits: EditAction[] };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: plan } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) return NextResponse.json({ error: "No active plan" }, { status: 404 });

  const results = [];

  for (const edit of edits) {
    if (edit.action === "create") {
      const dayOfWeek = new Date(edit.date + "T00:00:00").getDay();
      const { error } = await supabase.from("planned_workouts").insert({
        plan_id: plan.id,
        date: edit.date,
        day_of_week: dayOfWeek === 0 ? 6 : dayOfWeek - 1,
        session_type: edit.session_type,
        ai_notes: edit.ai_notes || null,
        targets: edit.targets || null,
        approved: true,
      });
      results.push({ action: "create", date: edit.date, success: !error });
    } else if (edit.action === "update") {
      const updates: Record<string, unknown> = {};
      if (edit.session_type) updates.session_type = edit.session_type;
      if (edit.ai_notes !== undefined) updates.ai_notes = edit.ai_notes;
      if (edit.targets !== undefined) updates.targets = edit.targets;
      const { error } = await supabase.from("planned_workouts").update(updates).eq("id", edit.workout_id).eq("plan_id", plan.id);
      results.push({ action: "update", id: edit.workout_id, success: !error });
    } else if (edit.action === "delete") {
      const { error } = await supabase.from("planned_workouts").delete().eq("id", edit.workout_id).eq("plan_id", plan.id);
      results.push({ action: "delete", id: edit.workout_id, success: !error });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plan/approve/route.ts src/app/api/plan/edit/route.ts
git commit -m "feat: add /api/plan/approve and /api/plan/edit endpoints"
```

---

### Task 10: Run Full Test Suite & Final Commit

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing errors unrelated to this feature).

- [ ] **Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "chore: final cleanup for AI training plan feature"
```
