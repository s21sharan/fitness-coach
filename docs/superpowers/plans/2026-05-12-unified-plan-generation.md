# Unified Multi-Week Plan Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the two disconnected plan generation systems (onboarding preview vs coach regeneration) into one unified multi-week format that produces dramatically better training plans.

**Architecture:** Replace the current single-week-repeated-N-times approach with true multi-week generation using the rich PlanPreviewWeek schema (AM/PM splits, per-session rationales, week focus, progressive overload). Add a compliance feedback loop so plans adapt to what the user actually did. The conversion from rich format to flat `planned_workouts` rows already exists in `combineDaySessions()` — we reuse it everywhere.

**Tech Stack:** TypeScript, Zod, AI SDK `generateObject()`, Vitest, Supabase

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/training/schemas.ts` | Modify | Add `multiWeekPlanSchema` Zod schema |
| `__tests__/lib/training/schemas.test.ts` | Modify | Test new schema validation |
| `src/lib/training/compliance.ts` | Create | Planned-vs-actual comparison stats |
| `__tests__/lib/training/compliance.test.ts` | Create | Test compliance calculation |
| `src/lib/training/prompts.ts` | Modify | Rewrite system prompt, add compliance to user prompt |
| `__tests__/lib/training/prompts.test.ts` | Modify | Test enriched prompt builder |
| `src/lib/training/generate-plan.ts` | Modify | Add `generateMultiWeekPlan()`, `expandBlocksToWorkouts()`, fix recentActivity bug |
| `__tests__/lib/training/generate-plan.test.ts` | Modify | Test multi-week expansion |
| `src/lib/chat/tools/regenerate-plan.ts` | Modify | Use unified multi-week generation |
| `src/app/api/plan/accept/route.ts` | Modify | Accept multi-week `blocks` format |
| `src/components/chat/plan-proposal-card.tsx` | Modify | Display multi-week layout with week focus |

---

### Task 1: Multi-week Zod schema

**Files:**
- Modify: `src/lib/training/schemas.ts`
- Modify: `__tests__/lib/training/schemas.test.ts`

- [ ] **Step 1: Write failing tests for new schema**

Add to `__tests__/lib/training/schemas.test.ts`:

```typescript
import {
  planGenerationSchema,
  dayLayoutSchema,
  workoutTargetsSchema,
  multiWeekPlanSchema,
  type PlanGeneration,
  type WorkoutTargets,
  type MultiWeekPlan,
} from "@/lib/training/schemas";

// ... existing tests stay unchanged ...

describe("multiWeekPlanSchema", () => {
  it("validates a 2-week hybrid plan with AM/PM splits", () => {
    const plan: MultiWeekPlan = {
      split_type: "hybrid_upper_lower",
      narrative: "Build phase — increasing intensity while maintaining aerobic base. Lifting shifts to upper/lower to free legs for key cardio days.",
      risks: [
        "Heavy lower body on Wednesday may affect Thursday tempo quality",
        "Two-a-days on Tuesday require adequate fueling",
      ],
      plan_config: {
        periodization_phase: "build",
        race_weeks_out: 12,
        deload_frequency: 3,
      },
      weeks: [
        {
          week_number: 1,
          week_focus: "Establish rhythm — moderate volume, calibrate effort levels across all sessions.",
          days: [
            { day_label: "Mon", am_session: "Easy Run (Zone 2) — 40min", am_rationale: "Flush legs from weekend long run", pm_session: "Upper Body", pm_rationale: "Push/pull compounds while legs recover", is_rest: false, notes: null },
            { day_label: "Tue", am_session: "Swim Technique — 1500m drills", am_rationale: "Low-impact active recovery + skill work", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Wed", am_session: null, am_rationale: null, pm_session: "Lower Body", pm_rationale: "Squat/hinge focus — keep RPE 7-8", is_rest: false, notes: null },
            { day_label: "Thu", am_session: "Tempo Run — 5x1km @ 4:30/km, 90s jog", am_rationale: "Key quality session — fresh from PM-only yesterday", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Fri", am_session: null, am_rationale: null, pm_session: "Upper Body", pm_rationale: "Horizontal push/pull emphasis", is_rest: false, notes: null },
            { day_label: "Sat", am_session: "Long Ride — 90min Zone 2", am_rationale: "Aerobic anchor — build bike volume", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Sun", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Full rest — absorb the week" },
          ],
        },
        {
          week_number: 2,
          week_focus: "Progress slightly — add 10% to cardio volumes, maintain lifting loads.",
          days: [
            { day_label: "Mon", am_session: "Easy Run (Zone 2) — 45min", am_rationale: "Slightly longer than last week", pm_session: "Upper Body", pm_rationale: "Same structure, push for 1 more rep per set", is_rest: false, notes: null },
            { day_label: "Tue", am_session: "Swim — 1800m with 4x100 threshold", am_rationale: "Add threshold set to technique day", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Wed", am_session: null, am_rationale: null, pm_session: "Lower Body", pm_rationale: "Same movements — add 2.5kg to main lifts", is_rest: false, notes: null },
            { day_label: "Thu", am_session: "Tempo Run — 6x1km @ 4:25/km, 90s jog", am_rationale: "One more rep, slightly faster — progressive overload", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Fri", am_session: null, am_rationale: null, pm_session: "Upper Body", pm_rationale: "Horizontal emphasis — progress weight or reps", is_rest: false, notes: null },
            { day_label: "Sat", am_session: "Long Ride — 100min Zone 2 + 3x5min Z3", am_rationale: "Longer + add tempo blocks to aerobic ride", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
            { day_label: "Sun", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Full rest" },
          ],
        },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("validates a lifting-only 2-week PPL plan", () => {
    const makeDays = (prefix: string) => [
      { day_label: "Mon" as const, am_session: null, am_rationale: null, pm_session: `Push — ${prefix}`, pm_rationale: "Chest/shoulders/triceps", is_rest: false, notes: null },
      { day_label: "Tue" as const, am_session: null, am_rationale: null, pm_session: `Pull — ${prefix}`, pm_rationale: "Back/biceps", is_rest: false, notes: null },
      { day_label: "Wed" as const, am_session: null, am_rationale: null, pm_session: `Legs — ${prefix}`, pm_rationale: "Squat focus", is_rest: false, notes: null },
      { day_label: "Thu" as const, am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Rest" },
      { day_label: "Fri" as const, am_session: null, am_rationale: null, pm_session: `Push — ${prefix}`, pm_rationale: "Overhead focus", is_rest: false, notes: null },
      { day_label: "Sat" as const, am_session: null, am_rationale: null, pm_session: `Pull — ${prefix}`, pm_rationale: "Row focus", is_rest: false, notes: null },
      { day_label: "Sun" as const, am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Rest" },
    ];

    const plan: MultiWeekPlan = {
      split_type: "ppl",
      narrative: "Hypertrophy block — 6 days, PPL rotation. Week 2 adds volume via extra set on compounds.",
      risks: ["6-day split is demanding — monitor sleep and soreness"],
      plan_config: { deload_frequency: 4 },
      weeks: [
        { week_number: 1, week_focus: "Establish working weights at RPE 7", days: makeDays("3x10 RPE 7") },
        { week_number: 2, week_focus: "Add one set to compounds — 4x10 RPE 7-8", days: makeDays("4x10 RPE 7-8") },
      ],
    };

    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("rejects plan with 0 weeks", () => {
    const plan = {
      split_type: "ppl",
      narrative: "test",
      risks: [],
      plan_config: {},
      weeks: [],
    };
    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("rejects week with wrong number of days", () => {
    const plan = {
      split_type: "ppl",
      narrative: "test",
      risks: [],
      plan_config: {},
      weeks: [{
        week_number: 1,
        week_focus: "test",
        days: [
          { day_label: "Mon", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null },
        ],
      }],
    };
    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("rejects invalid day_label", () => {
    const restDay = { am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null };
    const plan = {
      split_type: "ppl",
      narrative: "test",
      risks: [],
      plan_config: {},
      weeks: [{
        week_number: 1,
        week_focus: "test",
        days: [
          { day_label: "Monday", ...restDay },  // should be "Mon"
          { day_label: "Tue", ...restDay },
          { day_label: "Wed", ...restDay },
          { day_label: "Thu", ...restDay },
          { day_label: "Fri", ...restDay },
          { day_label: "Sat", ...restDay },
          { day_label: "Sun", ...restDay },
        ],
      }],
    };
    const result = multiWeekPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/schemas.test.ts`
Expected: FAIL — `multiWeekPlanSchema` and `MultiWeekPlan` not exported from schemas.ts

- [ ] **Step 3: Implement the multi-week schema**

Add to the bottom of `src/lib/training/schemas.ts` (keep all existing schemas untouched):

```typescript
// --- Multi-week plan schema (unified format) ---
// Mirrors PlanPreviewDay / PlanPreviewWeekBlock from onboarding/types.ts
// as a Zod schema usable with AI SDK generateObject().

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const sessionDaySchema = z.object({
  day_label: z.enum(DAY_LABELS),
  am_session: z.string().nullable(),
  am_rationale: z.string().nullable(),
  pm_session: z.string().nullable(),
  pm_rationale: z.string().nullable(),
  is_rest: z.boolean(),
  notes: z.string().nullable(),
});

export type SessionDay = z.infer<typeof sessionDaySchema>;

export const weekBlockSchema = z.object({
  week_number: z.number().int().min(1),
  week_focus: z.string().min(1),
  days: z.array(sessionDaySchema).length(7),
});

export type WeekBlock = z.infer<typeof weekBlockSchema>;

export const multiWeekPlanSchema = z.object({
  split_type: z.enum(SPLIT_TYPES),
  narrative: z.string().min(1),
  risks: z.array(z.string()),
  plan_config: planConfigSchema,
  weeks: z.array(weekBlockSchema).min(1).max(4),
});

export type MultiWeekPlan = z.infer<typeof multiWeekPlanSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/schemas.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/schemas.ts __tests__/lib/training/schemas.test.ts
git commit -m "feat: add multiWeekPlanSchema for unified plan generation"
```

---

### Task 2: Compliance stats module

**Files:**
- Create: `src/lib/training/compliance.ts`
- Create: `__tests__/lib/training/compliance.test.ts`

- [ ] **Step 1: Write failing tests for compliance calculation**

Create `__tests__/lib/training/compliance.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeComplianceStats, type ComplianceInput } from "@/lib/training/compliance";

describe("computeComplianceStats", () => {
  it("returns perfect compliance when all sessions completed", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Easy Run (Zone 2)", is_cardio: true },
        { date: "2026-05-06", session_type: "Legs", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
        { date: "2026-05-06", name: "Leg Day" },
      ],
      actualCardio: [
        { date: "2026-05-05", type: "run", distance: 8 },
      ],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(3);
    expect(stats.totalCompleted).toBe(3);
    expect(stats.completionRate).toBeCloseTo(1.0);
    expect(stats.liftCompliance).toEqual({ planned: 2, completed: 2 });
    expect(stats.cardioCompliance).toEqual({ planned: 1, completed: 1 });
    expect(stats.skippedSessions).toEqual([]);
  });

  it("identifies skipped sessions", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Tempo Run", is_cardio: true },
        { date: "2026-05-06", session_type: "Legs", is_cardio: false },
        { date: "2026-05-07", session_type: "Rest", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
      ],
      actualCardio: [],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(3); // Rest not counted
    expect(stats.totalCompleted).toBe(1);
    expect(stats.completionRate).toBeCloseTo(1 / 3);
    expect(stats.skippedSessions).toEqual([
      "2026-05-05: Tempo Run",
      "2026-05-06: Legs",
    ]);
  });

  it("detects extra sessions not in the plan", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
      ],
      actualLifting: [
        { date: "2026-05-04", name: "Push Day" },
        { date: "2026-05-05", name: "Arms" },
      ],
      actualCardio: [
        { date: "2026-05-06", type: "run", distance: 5 },
      ],
    };

    const stats = computeComplianceStats(input);
    expect(stats.extraSessions).toEqual([
      "2026-05-05: Arms (lifting)",
      "2026-05-06: run (cardio)",
    ]);
  });

  it("handles empty data gracefully", () => {
    const stats = computeComplianceStats({
      planned: [],
      actualLifting: [],
      actualCardio: [],
    });
    expect(stats.totalPlanned).toBe(0);
    expect(stats.totalCompleted).toBe(0);
    expect(stats.completionRate).toBe(0);
    expect(stats.skippedSessions).toEqual([]);
    expect(stats.extraSessions).toEqual([]);
  });

  it("excludes rest days from planned count", () => {
    const input: ComplianceInput = {
      planned: [
        { date: "2026-05-04", session_type: "Push", is_cardio: false },
        { date: "2026-05-05", session_type: "Rest", is_cardio: false },
        { date: "2026-05-06", session_type: "rest", is_cardio: false },
      ],
      actualLifting: [{ date: "2026-05-04", name: "Push" }],
      actualCardio: [],
    };

    const stats = computeComplianceStats(input);
    expect(stats.totalPlanned).toBe(1);
    expect(stats.completionRate).toBeCloseTo(1.0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/compliance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement compliance stats**

Create `src/lib/training/compliance.ts`:

```typescript
export interface ComplianceInput {
  planned: Array<{ date: string; session_type: string; is_cardio: boolean }>;
  actualLifting: Array<{ date: string; name: string }>;
  actualCardio: Array<{ date: string; type: string; distance: number }>;
}

export interface ComplianceStats {
  totalPlanned: number;
  totalCompleted: number;
  completionRate: number;
  liftCompliance: { planned: number; completed: number };
  cardioCompliance: { planned: number; completed: number };
  skippedSessions: string[];
  extraSessions: string[];
}

function isRest(sessionType: string): boolean {
  return /^rest$/i.test(sessionType.trim());
}

export function computeComplianceStats(input: ComplianceInput): ComplianceStats {
  const { planned, actualLifting, actualCardio } = input;

  const activePlanned = planned.filter((p) => !isRest(p.session_type));

  const liftPlanned = activePlanned.filter((p) => !p.is_cardio);
  const cardioPlanned = activePlanned.filter((p) => p.is_cardio);

  const liftDates = new Set(actualLifting.map((a) => a.date));
  const cardioDates = new Set(actualCardio.map((a) => a.date));

  const liftCompleted = liftPlanned.filter((p) => liftDates.has(p.date)).length;
  const cardioCompleted = cardioPlanned.filter((p) => cardioDates.has(p.date)).length;
  const totalCompleted = liftCompleted + cardioCompleted;

  const plannedDates = new Set(activePlanned.map((p) => p.date));

  const skippedSessions = activePlanned
    .filter((p) => {
      if (p.is_cardio) return !cardioDates.has(p.date);
      return !liftDates.has(p.date);
    })
    .map((p) => `${p.date}: ${p.session_type}`);

  const extraSessions: string[] = [];
  for (const a of actualLifting) {
    if (!plannedDates.has(a.date)) {
      extraSessions.push(`${a.date}: ${a.name} (lifting)`);
    }
  }
  for (const a of actualCardio) {
    if (!plannedDates.has(a.date)) {
      extraSessions.push(`${a.date}: ${a.type} (cardio)`);
    }
  }

  return {
    totalPlanned: activePlanned.length,
    totalCompleted,
    completionRate: activePlanned.length > 0 ? totalCompleted / activePlanned.length : 0,
    liftCompliance: { planned: liftPlanned.length, completed: liftCompleted },
    cardioCompliance: { planned: cardioPlanned.length, completed: cardioCompleted },
    skippedSessions,
    extraSessions,
  };
}

export function formatComplianceForPrompt(stats: ComplianceStats): string {
  if (stats.totalPlanned === 0) return "";

  const lines: string[] = [];
  const pct = Math.round(stats.completionRate * 100);
  lines.push(`Plan adherence (last 2 weeks): ${pct}% (${stats.totalCompleted}/${stats.totalPlanned} sessions)`);
  lines.push(`  Lifting: ${stats.liftCompliance.completed}/${stats.liftCompliance.planned}`);
  lines.push(`  Cardio: ${stats.cardioCompliance.completed}/${stats.cardioCompliance.planned}`);

  if (stats.skippedSessions.length > 0) {
    lines.push(`Skipped sessions:`);
    for (const s of stats.skippedSessions.slice(0, 5)) {
      lines.push(`  - ${s}`);
    }
  }

  if (stats.extraSessions.length > 0) {
    lines.push(`Extra sessions (not in plan):`);
    for (const s of stats.extraSessions.slice(0, 5)) {
      lines.push(`  + ${s}`);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/compliance.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/compliance.ts __tests__/lib/training/compliance.test.ts
git commit -m "feat: add compliance stats module for plan feedback loop"
```

---

### Task 3: Enriched system prompt

**Files:**
- Modify: `src/lib/training/prompts.ts`
- Modify: `__tests__/lib/training/prompts.test.ts`

- [ ] **Step 1: Write failing tests for new prompt builder**

Add to `__tests__/lib/training/prompts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildUserPrompt, buildMultiWeekUserPrompt, MULTI_WEEK_SYSTEM_PROMPT } from "@/lib/training/prompts";
import type { UserContext, RecentActivity, MultiWeekPromptContext } from "@/lib/training/prompts";

// ... keep all existing tests unchanged ...

describe("MULTI_WEEK_SYSTEM_PROMPT", () => {
  it("includes coaching methodology", () => {
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("80/20");
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("progressive overload");
  });

  it("includes sequencing rules", () => {
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("heavy lower-body");
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("hard/easy");
  });

  it("includes AM/PM session format guidance", () => {
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("am_session");
    expect(MULTI_WEEK_SYSTEM_PROMPT).toContain("pm_session");
  });
});

describe("buildMultiWeekUserPrompt", () => {
  const baseContext: MultiWeekPromptContext = {
    age: 28,
    height: 180,
    weight: 175,
    sex: "male",
    experience: "intermediate",
    bodyGoal: "maintain",
    emphasis: null,
    daysPerWeek: 6,
    liftingDays: 3,
    trainingForRace: true,
    raceType: "half_ironman",
    raceDate: "2026-09-15",
    goalTime: "5:30:00",
    doesCardio: true,
    cardioTypes: ["running", "cycling", "swimming"],
    recentActivity: null,
    compliance: null,
    weeksToGenerate: 2,
  };

  it("includes race info with weeks-out calculation", () => {
    const prompt = buildMultiWeekUserPrompt(baseContext);
    expect(prompt).toContain("Half Ironman");
    expect(prompt).toContain("weeks out");
    expect(prompt).toContain("Goal time: 5:30:00");
  });

  it("includes compliance data when provided", () => {
    const prompt = buildMultiWeekUserPrompt({
      ...baseContext,
      compliance: "Plan adherence (last 2 weeks): 70% (7/10 sessions)\n  Lifting: 5/6\n  Cardio: 2/4",
    });
    expect(prompt).toContain("Plan adherence");
    expect(prompt).toContain("70%");
    expect(prompt).toContain("Lifting: 5/6");
  });

  it("requests correct number of weeks", () => {
    const prompt = buildMultiWeekUserPrompt({ ...baseContext, weeksToGenerate: 3 });
    expect(prompt).toContain("Generate exactly 3 weeks");
  });

  it("includes recent activity when provided", () => {
    const prompt = buildMultiWeekUserPrompt({
      ...baseContext,
      recentActivity: {
        avgRunPaceMinKm: 5.2,
        avgRunDistanceKm: 9.5,
        avgRunHr: 152,
        weeklyRunCount: 3.5,
        weeklyLiftCount: 3,
        avgLiftDurationMin: 55,
        avgHrv: 58,
        avgSleepHours: 7.2,
      },
    });
    expect(prompt).toContain("5.2 min/km");
    expect(prompt).toContain("9.5 km");
    expect(prompt).toContain("HRV: 58");
  });

  it("omits compliance section when null", () => {
    const prompt = buildMultiWeekUserPrompt(baseContext);
    expect(prompt).not.toContain("Plan adherence");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/prompts.test.ts`
Expected: FAIL — `MULTI_WEEK_SYSTEM_PROMPT` and `buildMultiWeekUserPrompt` not exported

- [ ] **Step 3: Implement enriched prompts**

Add the following exports to `src/lib/training/prompts.ts` (keep existing `PLAN_SYSTEM_PROMPT` and `buildUserPrompt` for backward compat):

```typescript
export interface MultiWeekPromptContext extends UserContext {
  compliance: string | null;
  weeksToGenerate: number;
}

export const MULTI_WEEK_SYSTEM_PROMPT = `You are an expert hybrid-athlete coach producing a structured multi-week training block.

## Coaching Methodology
- **Endurance:** 80/20 polarized approach — ~80% easy/Zone 2, ~20% threshold/VO2max work.
- **Lifting:** progressive overload via volume or intensity week-over-week. RPE-based autoregulation.
- **Hybrid sequencing:** hard/easy day alternation. Never schedule heavy lower-body lifting the day before a key cardio session (tempo, intervals, long run/ride).
- **Deload:** Every 3rd or 4th week, reduce volume 30-40% while maintaining intensity.
- **Two-a-days:** Only when the athlete has the time and recovery capacity. Place the priority session in the slot where the athlete has more energy (usually AM for cardio, PM for lifting).

## Session Specificity
Sessions must be specific and actionable — not generic labels.
- BAD: "Tempo Run", "Easy Run", "Upper Body"
- GOOD: "Tempo Run — 5x1km @ 4:20/km, 90s jog recovery", "Easy Run — 45min Zone 2, conversational pace", "Upper Body — horizontal push/pull emphasis, 3x8-10 RPE 7"

## Progressive Overload Between Weeks
Each week MUST differ from the previous. Never repeat a week verbatim. Progress through:
- Cardio: increase duration 5-10%, add intervals, increase pace target
- Lifting: add 1 set to compounds, increase RPE from 7→8, increase weight 2-5%
- If it's a deload week, reduce volume by 30-40% while keeping some intensity

## Day Layout Format
Each day has am_session and pm_session slots (both can be null). Use them to:
- Schedule two-a-days when the athlete has AM+PM availability
- Place key quality sessions when the athlete is freshest
- Place easier/recovery work in the other slot

Set is_rest=true and leave both sessions null for full rest days.

## Session Format Rules
- am_session / pm_session: specific short strings. Include the key parameters.
  Running: "Easy Run — 45min Zone 2" or "Intervals — 8x400m @ 5K pace, 200m jog"
  Lifting: "Upper Body — push/pull compounds, 3x8-10 RPE 7" or "Lower Body — squat/hinge, 4x6 RPE 8"
  Swimming: "Swim Technique — 2000m, 4x100 @ CSS, drills"
  Cycling: "Zone 2 Ride — 90min easy" or "Bike Intervals — 5x4min @ FTP, 3min spin"
- am_rationale / pm_rationale: one sentence explaining why this session is placed here and now
- day_label: exactly "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"

## Week Block Format
Each week has a week_focus explaining the training intent for that week.
- Week 1 of a new plan: "Establish rhythm — calibrate effort levels, moderate volume"
- Progression week: "Progress volume +10%, maintain intensity targets"
- Deload week: "Recovery week — volume cut 35%, keep 2 quality sessions"

## Risk Awareness
Identify 1-3 real risks tailored to THIS athlete's situation (not generic advice).
Examples: "Volume ramp is aggressive given 7h sleep average", "Heavy legs on Wed may compromise Thursday tempo", "HRV trending down — consider auto-regulating Thursday intensity"`;

export function buildMultiWeekUserPrompt(ctx: MultiWeekPromptContext): string {
  const lines: string[] = [];

  lines.push("Create a multi-week training plan for this athlete:");
  lines.push("");

  // Profile
  const profileParts: string[] = [];
  if (ctx.age) profileParts.push(`${ctx.age}yo`);
  if (ctx.sex) profileParts.push(ctx.sex);
  if (ctx.height) profileParts.push(`${Math.round(ctx.height)}cm`);
  if (ctx.weight) profileParts.push(`${ctx.weight}lbs`);
  if (ctx.experience) profileParts.push(ctx.experience);
  if (profileParts.length > 0) lines.push(`Profile: ${profileParts.join(", ")}`);

  // Goals
  lines.push(`Goal: ${formatGoal(ctx.bodyGoal)}`);
  if (ctx.emphasis && ctx.emphasis !== "none") lines.push(`Emphasis: ${ctx.emphasis}`);
  lines.push(`Available days per week: ${ctx.daysPerWeek}`);
  if (ctx.liftingDays !== null && ctx.liftingDays !== ctx.daysPerWeek) {
    lines.push(`Lifting days: ${ctx.liftingDays}`);
  }
  lines.push("");

  // Race
  if (ctx.trainingForRace && ctx.raceType) {
    lines.push(`Training for: ${formatRaceType(ctx.raceType)}`);
    if (ctx.raceDate) {
      const weeksOut = getWeeksUntilRace(ctx.raceDate);
      lines.push(`Race date: ${ctx.raceDate} (${weeksOut} weeks out)`);
    }
    if (ctx.goalTime) lines.push(`Goal time: ${ctx.goalTime}`);
    lines.push("");
  }

  // Cardio (non-race)
  if (ctx.doesCardio && ctx.cardioTypes.length > 0 && !ctx.trainingForRace) {
    lines.push(`Also does cardio: ${ctx.cardioTypes.join(", ")}`);
    lines.push("");
  }

  // Today's date
  lines.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`);

  // Recent activity
  if (ctx.recentActivity) {
    const a = ctx.recentActivity;
    lines.push("");
    lines.push("Recent activity data (last 30 days):");
    if (a.avgRunPaceMinKm) lines.push(`  Avg easy run pace: ${a.avgRunPaceMinKm} min/km`);
    if (a.avgRunDistanceKm) lines.push(`  Avg run distance: ${a.avgRunDistanceKm} km`);
    if (a.avgRunHr) lines.push(`  Avg run HR: ${a.avgRunHr} bpm`);
    lines.push(`  Weekly runs: ${a.weeklyRunCount}, weekly lifts: ${a.weeklyLiftCount}`);
    if (a.avgLiftDurationMin) lines.push(`  Avg lifting session: ${a.avgLiftDurationMin} min`);
    if (a.avgHrv) lines.push(`  Avg HRV: ${a.avgHrv}`);
    if (a.avgSleepHours) lines.push(`  Avg sleep: ${a.avgSleepHours}h`);
    lines.push("");
    lines.push("Use this data to set realistic pace, distance, and duration targets. Zone 2 pace should be ~10-15% slower than avg pace. Long runs should be 1.5-2x avg distance at easy pace.");
  }

  // Compliance feedback
  if (ctx.compliance) {
    lines.push("");
    lines.push("--- Previous plan compliance ---");
    lines.push(ctx.compliance);
    lines.push("");
    lines.push("Adapt the new plan based on this adherence data:");
    lines.push("- If cardio compliance is low, consider reducing cardio frequency or combining with lifting days");
    lines.push("- If lifting compliance is low, consider fewer lifting days or shorter sessions");
    lines.push("- If extra sessions appear, incorporate what the athlete gravitates toward");
    lines.push("- If overall compliance is high, the plan complexity and volume are appropriate");
  }

  lines.push("");
  lines.push(`Generate exactly ${ctx.weeksToGenerate} weeks of training. Day labels must be exactly: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" in order.`);

  return lines.join("\n");
}
```

Note: Keep the existing `formatGoal`, `formatRaceType`, `getWeeksUntilRace` helper functions unchanged — they're reused by the new function.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/prompts.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/prompts.ts __tests__/lib/training/prompts.test.ts
git commit -m "feat: add enriched multi-week system prompt with coaching methodology"
```

---

### Task 4: Multi-week generation + workout expansion

**Files:**
- Modify: `src/lib/training/generate-plan.ts`
- Modify: `__tests__/lib/training/generate-plan.test.ts`

- [ ] **Step 1: Write failing tests for block-to-workout expansion**

Add to `__tests__/lib/training/generate-plan.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generatePlannedWorkouts, expandBlocksToWorkouts } from "@/lib/training/generate-plan";
import type { DayLayout } from "@/lib/training/schemas";
import type { WeekBlock } from "@/lib/training/schemas";

// ... keep all existing tests unchanged ...

describe("expandBlocksToWorkouts", () => {
  it("converts multi-week blocks to planned_workout rows using combineDaySessions", () => {
    const blocks: WeekBlock[] = [
      {
        week_number: 1,
        week_focus: "Base week",
        days: [
          { day_label: "Mon", am_session: "Easy Run — 40min Zone 2", am_rationale: "Aerobic base", pm_session: "Upper Body — push/pull 3x10", pm_rationale: "Strength work", is_rest: false, notes: null },
          { day_label: "Tue", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Rest" },
          { day_label: "Wed", am_session: null, am_rationale: null, pm_session: "Lower Body — squat focus", pm_rationale: "Leg day", is_rest: false, notes: null },
          { day_label: "Thu", am_session: "Tempo Run — 4x1km @ 4:30", am_rationale: "Quality session", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
          { day_label: "Fri", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Rest" },
          { day_label: "Sat", am_session: "Long Run — 90min Zone 2", am_rationale: "Weekly long run", pm_session: null, pm_rationale: null, is_rest: false, notes: null },
          { day_label: "Sun", am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: "Full rest" },
        ],
      },
    ];

    const startDate = new Date("2026-05-18"); // Monday
    const workouts = expandBlocksToWorkouts("plan-abc", blocks, startDate);

    expect(workouts).toHaveLength(7);

    // Monday: AM + PM combined
    expect(workouts[0].date).toBe("2026-05-18");
    expect(workouts[0].session_type).toContain("AM:");
    expect(workouts[0].session_type).toContain("PM:");
    expect(workouts[0].ai_notes).toContain("AM");

    // Tuesday: rest
    expect(workouts[1].date).toBe("2026-05-19");
    expect(workouts[1].session_type).toBe("Rest");

    // Thursday: AM only
    expect(workouts[3].date).toBe("2026-05-21");
    expect(workouts[3].session_type).toContain("Tempo Run");
  });

  it("handles 2-week blocks with correct date progression", () => {
    const restDay = { am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null };
    const activeDay = { am_session: "Push Day", am_rationale: "Strength", pm_session: null, pm_rationale: null, is_rest: false, notes: null };

    const blocks: WeekBlock[] = [
      { week_number: 1, week_focus: "Week 1", days: [
        { day_label: "Mon", ...activeDay }, { day_label: "Tue", ...restDay },
        { day_label: "Wed", ...activeDay }, { day_label: "Thu", ...restDay },
        { day_label: "Fri", ...activeDay }, { day_label: "Sat", ...restDay },
        { day_label: "Sun", ...restDay },
      ]},
      { week_number: 2, week_focus: "Week 2", days: [
        { day_label: "Mon", ...activeDay }, { day_label: "Tue", ...restDay },
        { day_label: "Wed", ...activeDay }, { day_label: "Thu", ...restDay },
        { day_label: "Fri", ...activeDay }, { day_label: "Sat", ...restDay },
        { day_label: "Sun", ...restDay },
      ]},
    ];

    const startDate = new Date("2026-05-18");
    const workouts = expandBlocksToWorkouts("plan-xyz", blocks, startDate);

    expect(workouts).toHaveLength(14);
    // Week 1 Monday
    expect(workouts[0].date).toBe("2026-05-18");
    // Week 2 Monday
    expect(workouts[7].date).toBe("2026-05-25");
  });

  it("sets approved=true and status=scheduled on all rows", () => {
    const restDay = { am_session: null, am_rationale: null, pm_session: null, pm_rationale: null, is_rest: true, notes: null };
    const blocks: WeekBlock[] = [{
      week_number: 1,
      week_focus: "test",
      days: Array.from({ length: 7 }, (_, i) => ({
        day_label: (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const)[i],
        ...restDay,
      })),
    }];

    const workouts = expandBlocksToWorkouts("plan-1", blocks, new Date("2026-05-18"));
    for (const w of workouts) {
      expect(w.status).toBe("scheduled");
      expect(w.approved).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/generate-plan.test.ts`
Expected: FAIL — `expandBlocksToWorkouts` not exported

- [ ] **Step 3: Implement expandBlocksToWorkouts and generateMultiWeekPlan**

Add to `src/lib/training/generate-plan.ts`:

```typescript
import { type MultiWeekPlan, type WeekBlock, multiWeekPlanSchema } from "./schemas";
import { MULTI_WEEK_SYSTEM_PROMPT, buildMultiWeekUserPrompt, type MultiWeekPromptContext } from "./prompts";
import { combineDaySessions } from "./seed-plan-from-onboarding";
import type { PlanPreviewDay } from "@/lib/onboarding/types";

const DAY_LABEL_TO_INDEX: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

export function expandBlocksToWorkouts(
  planId: string,
  blocks: WeekBlock[],
  startDate: Date,
): Array<{
  plan_id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: Record<string, unknown> | null;
  status: string;
  approved: boolean;
}> {
  const workouts: Array<{
    plan_id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    targets: Record<string, unknown> | null;
    status: string;
    approved: boolean;
  }> = [];

  for (const block of blocks) {
    const weekOffset = block.week_number - 1;
    for (const day of block.days) {
      const dayIdx = DAY_LABEL_TO_INDEX[day.day_label] ?? 0;
      const date = new Date(startDate);
      date.setDate(date.getDate() + weekOffset * 7 + dayIdx);
      const dateStr = date.toISOString().slice(0, 10);

      // Convert rich AM/PM format to flat session_type + targets using
      // the same conversion the onboarding flow uses.
      const previewDay: PlanPreviewDay = {
        day_label: day.day_label,
        am_session: day.am_session,
        am_rationale: day.am_rationale,
        pm_session: day.pm_session,
        pm_rationale: day.pm_rationale,
        is_rest: day.is_rest,
        notes: day.notes,
      };
      const { session_type, ai_notes, targets } = combineDaySessions(previewDay);

      workouts.push({
        plan_id: planId,
        date: dateStr,
        day_of_week: dayIdx,
        session_type,
        ai_notes,
        targets: targets as Record<string, unknown> | null,
        status: "scheduled",
        approved: true,
      });
    }
  }

  return workouts;
}

export interface GenerateMultiWeekInput {
  userId: string;
  profile: {
    age: number | null;
    height: number | null;
    weight: number | null;
    sex: string | null;
    training_experience: string | null;
  };
  goals: {
    body_goal: string;
    emphasis: string | null;
    days_per_week: number;
    lifting_days: number | null;
    training_for_race: boolean;
    race_type: string | null;
    race_date: string | null;
    goal_time: string | null;
    does_cardio: boolean;
    cardio_types: string[] | null;
  };
  weeks: number;
  compliance: string | null;
  userRequest?: string;
}

export async function generateMultiWeekPlan(input: GenerateMultiWeekInput): Promise<MultiWeekPlan> {
  const recentActivity = await getRecentActivityStats(input.userId);

  const ctx: MultiWeekPromptContext = {
    age: input.profile.age,
    height: input.profile.height,
    weight: input.profile.weight,
    sex: input.profile.sex,
    experience: input.profile.training_experience,
    bodyGoal: input.goals.body_goal,
    emphasis: input.goals.emphasis,
    daysPerWeek: input.goals.days_per_week,
    liftingDays: input.goals.lifting_days,
    trainingForRace: input.goals.training_for_race,
    raceType: input.goals.race_type,
    raceDate: input.goals.race_date,
    goalTime: input.goals.goal_time,
    doesCardio: input.goals.does_cardio,
    cardioTypes: input.goals.cardio_types || [],
    recentActivity,
    compliance: input.compliance,
    weeksToGenerate: input.weeks,
  };

  let prompt = buildMultiWeekUserPrompt(ctx);

  if (input.userRequest) {
    prompt += `\n\nThe user specifically requested: ${input.userRequest}`;
  }

  const { object: plan } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: multiWeekPlanSchema,
    system: MULTI_WEEK_SYSTEM_PROMPT,
    prompt,
  });

  return plan;
}
```

Also fix the bug in the existing `generateTrainingPlan` — change the `recentActivity: null` to actually fetch it:

In `generateTrainingPlan()`, change the `buildUserPrompt` call (around line 121-138) to:

```typescript
  const recentActivity = await getRecentActivityStats(input.userId);

  const userPrompt = buildUserPrompt({
    age: input.profile.age,
    height: input.profile.height,
    weight: input.profile.weight,
    sex: input.profile.sex,
    experience: input.profile.training_experience,
    bodyGoal: input.goals.body_goal,
    emphasis: input.goals.emphasis,
    daysPerWeek: input.goals.days_per_week,
    liftingDays: input.goals.lifting_days,
    trainingForRace: input.goals.training_for_race,
    raceType: input.goals.race_type,
    raceDate: input.goals.race_date,
    goalTime: input.goals.goal_time,
    doesCardio: input.goals.does_cardio,
    cardioTypes: input.goals.cardio_types || [],
    recentActivity,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/generate-plan.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/generate-plan.ts __tests__/lib/training/generate-plan.test.ts
git commit -m "feat: add multi-week plan generation with block expansion and fix recentActivity bug"
```

---

### Task 5: Update regenerate-plan tool

**Files:**
- Modify: `src/lib/chat/tools/regenerate-plan.ts`

- [ ] **Step 1: Rewrite regenerate-plan tool to use unified generation**

Replace the contents of `src/lib/chat/tools/regenerate-plan.ts`:

```typescript
import { z } from "zod";
import { tool } from "ai";
import { createServerClient } from "@/lib/supabase/server";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { getRecentActivityStats } from "@/lib/training/generate-plan";
import { computeComplianceStats, formatComplianceForPrompt, type ComplianceInput } from "@/lib/training/compliance";
import { SPLIT_TYPES } from "@/lib/training/schemas";

export function regeneratePlanTool(userId: string) {
  return tool({
    description:
      "Generate a proposed multi-week training plan based on the user's request. Returns a proposal for the user to review and approve — does NOT save to database. Use when the user wants to change their training split, restructure their week, or create a new plan.",
    inputSchema: z.object({
      user_request: z
        .string()
        .describe("The user's full description of what they want their training plan to look like"),
      split_type: z
        .enum(SPLIT_TYPES)
        .describe("The closest matching split type for the new plan"),
      days_per_week: z
        .number()
        .min(3)
        .max(7)
        .describe("Total training days per week"),
    }),
    execute: async ({ user_request, split_type, days_per_week }) => {
      const supabase = createServerClient();

      const [profileRes, goalsRes, planRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_goals").select("*").eq("user_id", userId).single(),
        supabase.from("training_plans").select("id").eq("user_id", userId).eq("status", "active").single(),
      ]);

      const profile = profileRes.data;
      const goals = goalsRes.data;

      // Build compliance stats from last 2 weeks
      let complianceText: string | null = null;
      if (planRes.data) {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const sinceStr = twoWeeksAgo.toISOString().slice(0, 10);

        const [plannedRes, liftRes, cardioRes] = await Promise.all([
          supabase.from("planned_workouts")
            .select("date, session_type")
            .eq("plan_id", planRes.data.id)
            .gte("date", sinceStr)
            .lte("date", new Date().toISOString().slice(0, 10)),
          supabase.from("workout_logs")
            .select("date, name")
            .eq("user_id", userId)
            .gte("date", sinceStr),
          supabase.from("cardio_logs")
            .select("date, type, distance")
            .eq("user_id", userId)
            .gte("date", sinceStr),
        ]);

        if (plannedRes.data && plannedRes.data.length > 0) {
          const isCardioSession = (s: string) =>
            /run|ride|bike|swim|cardio|zone\s*2/i.test(s);

          const compInput: ComplianceInput = {
            planned: plannedRes.data.map((p) => ({
              date: p.date,
              session_type: p.session_type,
              is_cardio: isCardioSession(p.session_type),
            })),
            actualLifting: (liftRes.data || []).map((l) => ({ date: l.date, name: l.name })),
            actualCardio: (cardioRes.data || []).map((c) => ({ date: c.date, type: c.type, distance: c.distance })),
          };

          const stats = computeComplianceStats(compInput);
          if (stats.totalPlanned > 0) {
            complianceText = formatComplianceForPrompt(stats);
          }
        }
      }

      const plan = await generateMultiWeekPlan({
        userId,
        profile: {
          age: profile?.age ?? null,
          height: profile?.height ?? null,
          weight: profile?.weight ?? null,
          sex: profile?.sex ?? null,
          training_experience: profile?.training_experience ?? null,
        },
        goals: {
          body_goal: goals?.body_goal || "general_fitness",
          emphasis: goals?.emphasis ?? null,
          days_per_week: days_per_week,
          lifting_days: goals?.lifting_days ?? null,
          training_for_race: goals?.training_for_race ?? false,
          race_type: goals?.race_type ?? null,
          race_date: goals?.race_date ?? null,
          goal_time: goals?.goal_time ?? null,
          does_cardio: goals?.does_cardio ?? false,
          cardio_types: goals?.cardio_types ?? [],
        },
        weeks: 2,
        compliance: complianceText,
        userRequest: user_request,
      });

      // Format multi-week display for PlanProposalCard
      const weekLayouts = plan.weeks.map((week) => ({
        week_number: week.week_number,
        week_focus: week.week_focus,
        days: week.days.map((d) => {
          const parts: string[] = [];
          if (d.am_session) parts.push(d.am_session);
          if (d.pm_session) parts.push(d.pm_session);
          const session = d.is_rest ? "Rest" : parts.join(" + ") || "Rest";
          const notes = [d.am_rationale, d.pm_rationale].filter(Boolean).join("; ");
          return { day: d.day_label, session, notes: notes || null };
        }),
      }));

      return {
        success: true,
        proposed: true,
        split_type: plan.split_type,
        reasoning: plan.narrative,
        risks: plan.risks,
        weekly_layout: weekLayouts[0]?.days || [],
        week_layouts: weekLayouts,
        raw_blocks: plan.weeks,
        plan_config: plan.plan_config,
        body_goal: goals?.body_goal || "general_fitness",
        race_type: goals?.race_type || null,
      };
    },
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in regenerate-plan.ts (other pre-existing errors are fine)

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/tools/regenerate-plan.ts
git commit -m "feat: regenerate-plan tool uses unified multi-week generation with compliance"
```

---

### Task 6: Update plan/accept route

**Files:**
- Modify: `src/app/api/plan/accept/route.ts`

- [ ] **Step 1: Update plan/accept to handle multi-week blocks**

Update `src/app/api/plan/accept/route.ts` to accept both old flat `weekly_layout` and new `raw_blocks` format:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePlannedWorkouts, expandBlocksToWorkouts } from "@/lib/training/generate-plan";
import type { WeekBlock } from "@/lib/training/schemas";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { split_type, body_goal, race_type, plan_config, weekly_layout, raw_blocks } = body;

  if (!split_type || (!weekly_layout && !raw_blocks)) {
    return NextResponse.json({ error: "Missing plan data" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Deactivate existing active plan
  await supabase
    .from("training_plans")
    .update({ status: "completed" })
    .eq("user_id", userId)
    .eq("status", "active");

  // Create new plan
  const { data: newPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: userId,
      split_type,
      body_goal: body_goal || "general_fitness",
      race_type: race_type || null,
      status: "active",
      plan_config: plan_config || {},
    })
    .select("id")
    .single();

  if (planError || !newPlan) {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }

  // Calculate next Monday
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  // Generate workouts — use multi-week blocks if available, else fall back to flat layout
  let workouts;
  let weeksGenerated: number;

  if (raw_blocks && Array.isArray(raw_blocks) && raw_blocks.length > 0) {
    workouts = expandBlocksToWorkouts(newPlan.id, raw_blocks as WeekBlock[], nextMonday);
    weeksGenerated = raw_blocks.length;
  } else {
    workouts = generatePlannedWorkouts(newPlan.id, weekly_layout, nextMonday, 2);
    weeksGenerated = 2;
  }

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts);

  if (workoutsError) {
    return NextResponse.json({ error: "Failed to create workouts" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    plan_id: newPlan.id,
    weeks_generated: weeksGenerated,
    starts: nextMonday.toISOString().slice(0, 10),
  });
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "plan/accept" | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plan/accept/route.ts
git commit -m "feat: plan/accept route supports multi-week blocks format"
```

---

### Task 7: Update PlanProposalCard for multi-week display

**Files:**
- Modify: `src/components/chat/plan-proposal-card.tsx`

- [ ] **Step 1: Update PlanProposalCard to display multiple weeks**

The card currently shows a flat 7-day grid. Update it to show each week with a heading. The new `week_layouts` field from the regenerate tool contains per-week data; fall back to flat `weekly_layout` for backward compat.

Update `src/components/chat/plan-proposal-card.tsx`:

Add `week_layouts` to `PlanProposalData`:

```typescript
interface WeekLayout {
  week_number: number;
  week_focus: string;
  days: DayLayout[];
}

interface PlanProposalData {
  success: boolean;
  proposed?: boolean;
  split_type: string;
  reasoning: string;
  weekly_layout: DayLayout[];
  week_layouts?: WeekLayout[];
  raw_blocks?: unknown[];
  raw_layout?: unknown[];
  plan_config?: unknown;
  body_goal?: string;
  race_type?: string | null;
  risks?: string[];
  plan_id?: string;
  weeks_generated?: number;
  starts?: string;
}
```

Update `handleAccept` to send `raw_blocks` when available:

```typescript
  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch("/api/plan/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_type: data.split_type,
          body_goal: data.body_goal,
          race_type: data.race_type,
          plan_config: data.plan_config,
          weekly_layout: data.raw_layout,
          raw_blocks: data.raw_blocks,
        }),
      });
      if (res.ok) {
        setStatus("accepted");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };
```

Replace the weekly layout grid section with multi-week support:

```typescript
      {/* Risks */}
      {data.risks && data.risks.length > 0 && (
        <div style={{
          position: "relative", fontSize: 12, lineHeight: 1.5,
          color: "rgba(255,255,255,0.55)", marginBottom: 16,
          padding: "10px 14px", background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
        }}>
          {data.risks.map((risk, i) => (
            <div key={i} style={{ marginBottom: i < data.risks!.length - 1 ? 4 : 0 }}>
              ⚠ {risk}
            </div>
          ))}
        </div>
      )}

      {/* Weekly layout grids */}
      {(data.week_layouts && data.week_layouts.length > 0 ? data.week_layouts : [{ week_number: 1, week_focus: "", days: data.weekly_layout }]).map((week) => (
        <div key={week.week_number} style={{ position: "relative", marginBottom: 16 }}>
          {(data.week_layouts && data.week_layouts.length > 1) && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
              Week {week.week_number}
              {week.week_focus && (
                <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 10 }}>{week.week_focus}</span>
              )}
            </div>
          )}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6,
          }}>
            {week.days.map((d, i) => {
              const color = getSessionColor(d.session);
              return (
                <div key={i} style={{
                  background: color.bg, borderRadius: 10,
                  padding: "10px 6px", textAlign: "center",
                  border: `1.5px solid ${color.border}`,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: color.text, opacity: 0.7, marginBottom: 4 }}>
                    {d.day}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: color.text, lineHeight: 1.2, minHeight: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {d.session.length > 25 ? d.session.slice(0, 22) + "…" : d.session}
                  </div>
                  {d.notes && (
                    <div style={{ fontSize: 8, color: color.text, opacity: 0.6, marginTop: 4, lineHeight: 1.3 }}>
                      {d.notes.length > 30 ? d.notes.slice(0, 30) + "…" : d.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
```

Also update the header subtitle to show correct week count:

```typescript
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
          {data.week_layouts ? `${data.week_layouts.length} weeks` : "2 weeks"} · {status === "accepted" ? "added to your calendar" : "awaiting your approval"}
        </div>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "plan-proposal" | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/plan-proposal-card.tsx
git commit -m "feat: PlanProposalCard displays multi-week layout with risks"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Plan structure | Single 7-day layout repeated N times | N distinct weeks, each with own focus + progressive overload |
| Session format | "Push", "Tempo Run" (labels only) | "Push — horizontal push/pull, 3x8-10 RPE 7", "Tempo Run — 5x1km @ 4:20/km, 90s jog" |
| AM/PM support | None — single session per day | AM + PM slots with rationales |
| Recent activity | `null` (never fetched in main path) | 30-day stats: pace, HR, volume, HRV, sleep |
| Compliance feedback | None | 2-week planned-vs-actual with adherence %, skipped/extra sessions |
| System prompt | ~20 lines, generic | Full coaching methodology: 80/20, progressive overload rules, sequencing, specificity requirements |
| Week differentiation | Week 1 = Week 2 = Week 3 = Week 4 | Each week builds on previous with specific volume/intensity targets |
| Risk awareness | None | AI identifies 1-3 athlete-specific risks per plan |
| Backward compat | — | Old `weekly_layout` format still accepted by plan/accept; old schemas kept |
