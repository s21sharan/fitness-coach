# Phase 4: Training Plan Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded split recommendation with AI-powered plan generation (Claude + Vercel AI SDK), build a weekly training view UI with Hevy/Strava completion matching, and add weekly auto-adjustment via a Sunday night cron job.

**Architecture:** Next.js server action calls Claude via Vercel AI SDK `generateObject` for plan generation. `/dashboard/plan` page shows a 7-day strip with color-coded session types and synced completion data. Railway Express backend runs a Sunday night cron that gathers 7 days of data, sends to Claude for analysis, and stores proposed adjustments for user approval.

**Tech Stack:** Vercel AI SDK, @ai-sdk/anthropic, Claude API (structured output), React, Tailwind, Supabase, Express, node-cron, Vitest

**Design Spec:** `docs/superpowers/specs/2026-04-29-phase4-training-engine-design.md`

---

## File Structure

```
# Database
supabase/migrations/003_weekly_check_ins.sql          # weekly_check_ins table

# AI Plan Generation
src/lib/training/schemas.ts                            # Zod schemas for Claude structured output
src/lib/training/prompts.ts                            # System + user prompt builders
src/lib/training/generate-plan.ts                      # generateObject call + DB persistence
src/app/actions/training.ts                            # Server actions (generate, approve, reject)

# Weekly View UI
src/components/plan/week-strip.tsx                     # 7-day grid of DayCard components
src/components/plan/day-card.tsx                       # Individual day card (scheduled/completed/missed/rest)
src/components/plan/plan-header.tsx                    # Plan name, goal context, week navigation
src/components/plan/adjustment-banner.tsx              # Pending adjustment notification
src/components/plan/adjustment-review.tsx              # Review changes modal (approve/reject)
src/app/dashboard/plan/page.tsx                        # Rewritten plan page
src/app/api/plan/route.ts                              # GET plan data for current user
src/app/api/plan/check-in/route.ts                     # GET pending check-in, POST approve/reject

# Onboarding Integration
src/components/onboarding/step-split-result.tsx         # Rewritten to use AI generation

# Weekly Auto-Adjustment (Railway backend)
server/src/adjustment/gather-data.ts                   # Query 7 days of synced data
server/src/adjustment/weekly-check-in.ts               # Claude call + store results
server/src/adjustment/schemas.ts                       # Zod schemas for adjustment output
server/src/sync/scheduler.ts                           # Modified: add Sunday night cron

# Tests
__tests__/lib/training/schemas.test.ts
__tests__/lib/training/generate-plan.test.ts
__tests__/components/plan/day-card.test.tsx
__tests__/components/plan/week-strip.test.tsx
__tests__/components/plan/adjustment-banner.test.tsx
server/__tests__/adjustment/gather-data.test.ts
server/__tests__/adjustment/weekly-check-in.test.ts
```

---

## Task 1: Database Migration + Install Dependencies

**Files:**
- Create: `supabase/migrations/003_weekly_check_ins.sql`
- Modify: `package.json` (add AI SDK deps)

- [ ] **Step 1: Create weekly_check_ins migration**

```sql
-- supabase/migrations/003_weekly_check_ins.sql
create table public.weekly_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week_start_date date not null,
  compliance_pct integer default 0,
  avg_calories integer,
  avg_protein integer,
  avg_sleep_hours numeric,
  avg_hrv integer,
  weight_trend jsonb,
  training_volume jsonb,
  ai_summary text,
  adjustments jsonb,
  risk_flags jsonb,
  next_week_layout jsonb,
  user_approved boolean,
  created_at timestamptz not null default now()
);

alter table public.weekly_check_ins enable row level security;

create policy "Users can view own check-ins" on public.weekly_check_ins
  for select using (user_id = current_setting('app.current_user_id', true));

create policy "Users can update own check-ins" on public.weekly_check_ins
  for update using (user_id = current_setting('app.current_user_id', true));

create index idx_weekly_check_ins_user_week on public.weekly_check_ins(user_id, week_start_date);
create index idx_weekly_check_ins_plan on public.weekly_check_ins(plan_id);
```

- [ ] **Step 2: Install Vercel AI SDK and Anthropic provider**

Run: `npm install ai @ai-sdk/anthropic zod`

- [ ] **Step 3: Verify installation**

Run: `npm ls ai @ai-sdk/anthropic zod`
Expected: All three packages listed without errors

- [ ] **Step 4: Install Anthropic SDK in server too**

Run: `cd server && npm install ai @ai-sdk/anthropic zod`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_weekly_check_ins.sql package.json package-lock.json server/package.json server/package-lock.json
git commit -m "feat: add weekly_check_ins migration and AI SDK dependencies"
```

---

## Task 2: Plan Generation Schemas + Prompts

**Files:**
- Create: `src/lib/training/schemas.ts`
- Create: `src/lib/training/prompts.ts`
- Test: `__tests__/lib/training/schemas.test.ts`

- [ ] **Step 1: Write schema tests**

```typescript
// __tests__/lib/training/schemas.test.ts
import { describe, it, expect } from "vitest";
import { planGenerationSchema, type PlanGeneration } from "@/lib/training/schemas";

describe("planGenerationSchema", () => {
  it("validates a correct PPL plan", () => {
    const plan: PlanGeneration = {
      split_type: "ppl",
      reasoning: "6 days with balanced emphasis — PPL is the gold standard.",
      weekly_layout: [
        { day_of_week: 0, session_type: "Push", ai_notes: null },
        { day_of_week: 1, session_type: "Pull", ai_notes: null },
        { day_of_week: 2, session_type: "Legs", ai_notes: null },
        { day_of_week: 3, session_type: "Rest", ai_notes: null },
        { day_of_week: 4, session_type: "Push", ai_notes: null },
        { day_of_week: 5, session_type: "Pull", ai_notes: null },
        { day_of_week: 6, session_type: "Rest", ai_notes: null },
      ],
      plan_config: {
        deload_frequency: 4,
      },
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("validates a hybrid race plan with periodization", () => {
    const plan: PlanGeneration = {
      split_type: "hybrid_upper_lower",
      reasoning: "Half Ironman in 12 weeks — build phase with 3 lift + 3 cardio.",
      weekly_layout: [
        { day_of_week: 0, session_type: "Upper Body + Easy Run (Zone 2)", ai_notes: "Keep run under 5km" },
        { day_of_week: 1, session_type: "Tempo Run", ai_notes: null },
        { day_of_week: 2, session_type: "Lower Body", ai_notes: null },
        { day_of_week: 3, session_type: "Easy Run (Zone 2) + Swim", ai_notes: null },
        { day_of_week: 4, session_type: "Upper Body", ai_notes: null },
        { day_of_week: 5, session_type: "Long Ride + Brick Run", ai_notes: "Aim for 60km ride + 15 min brick" },
        { day_of_week: 6, session_type: "Rest", ai_notes: null },
      ],
      plan_config: {
        periodization_phase: "build",
        race_weeks_out: 12,
        deload_frequency: 3,
        notes: "Transition to peak phase at week 16",
      },
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(true);
  });

  it("rejects invalid split type", () => {
    const plan = {
      split_type: "invalid_split",
      reasoning: "test",
      weekly_layout: [],
      plan_config: {},
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it("requires exactly 7 days in weekly_layout", () => {
    const plan = {
      split_type: "ppl",
      reasoning: "test",
      weekly_layout: [
        { day_of_week: 0, session_type: "Push", ai_notes: null },
      ],
      plan_config: {},
    };

    const result = planGenerationSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/lib/training/schemas.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schemas**

```typescript
// src/lib/training/schemas.ts
import { z } from "zod";

export const SPLIT_TYPES = [
  "full_body",
  "upper_lower",
  "ppl",
  "arnold",
  "phul",
  "bro_split",
  "hybrid_upper_lower",
  "hybrid_nick_bare",
] as const;

export type SplitType = (typeof SPLIT_TYPES)[number];

const dayLayoutSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_type: z.string().min(1),
  ai_notes: z.string().nullable(),
});

export type DayLayout = z.infer<typeof dayLayoutSchema>;

const planConfigSchema = z.object({
  periodization_phase: z.enum(["base", "build", "peak", "taper"]).optional(),
  race_weeks_out: z.number().int().positive().optional(),
  deload_frequency: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type PlanConfig = z.infer<typeof planConfigSchema>;

export const planGenerationSchema = z.object({
  split_type: z.enum(SPLIT_TYPES),
  reasoning: z.string().min(1),
  weekly_layout: z.array(dayLayoutSchema).length(7),
  plan_config: planConfigSchema,
});

export type PlanGeneration = z.infer<typeof planGenerationSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/training/schemas.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Implement prompt builders**

```typescript
// src/lib/training/prompts.ts
interface UserContext {
  age: number | null;
  height: number | null; // cm
  weight: number | null; // lbs
  sex: string | null;
  experience: string | null;
  bodyGoal: string;
  emphasis: string | null;
  daysPerWeek: number;
  liftingDays: number | null;
  trainingForRace: boolean;
  raceType: string | null;
  raceDate: string | null;
  goalTime: string | null;
  doesCardio: boolean;
  cardioTypes: string[];
}

export const PLAN_SYSTEM_PROMPT = `You are a certified personal trainer and endurance coach creating a training plan.
Generate a structured training split based on the user's profile, goals, and constraints.
Your plan should be split-level (session types like "Push", "Upper Body", "Easy Run Zone 2"),
NOT exercise-level. Users choose their own exercises in their tracking apps.

For hybrid/race athletes, use proper periodization:
- Base phase: high volume, low intensity
- Build phase: increasing intensity, sport-specific work
- Peak phase: race-specific sessions, reduced volume
- Taper phase: significant volume reduction, maintain intensity

Session type examples:
- Lifting: "Push", "Pull", "Legs", "Upper Body", "Lower Body", "Full Body", "Chest + Back", "Shoulders + Arms"
- Cardio: "Easy Run (Zone 2)", "Tempo Run", "Intervals", "Long Run", "Long Ride", "Swim", "Long Ride + Brick Run"
- Multi-session days: "Upper Body + Easy Run (Zone 2)", "Easy Run (Zone 2) + Swim"
- Rest: "Rest"

day_of_week mapping: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday`;

export function buildUserPrompt(ctx: UserContext): string {
  const lines: string[] = [];

  lines.push("Create a training plan for this user:");
  lines.push("");

  if (ctx.age) lines.push(`Age: ${ctx.age}`);
  if (ctx.sex) lines.push(`Sex: ${ctx.sex}`);
  if (ctx.height) lines.push(`Height: ${Math.round(ctx.height)} cm`);
  if (ctx.weight) lines.push(`Weight: ${ctx.weight} lbs`);
  if (ctx.experience) lines.push(`Experience: ${ctx.experience}`);
  lines.push("");

  lines.push(`Goal: ${formatGoal(ctx.bodyGoal)}`);
  if (ctx.emphasis && ctx.emphasis !== "none") {
    lines.push(`Emphasis: ${ctx.emphasis}`);
  }
  lines.push(`Available days per week: ${ctx.daysPerWeek}`);
  if (ctx.liftingDays !== null && ctx.liftingDays !== ctx.daysPerWeek) {
    lines.push(`Lifting days: ${ctx.liftingDays}`);
  }
  lines.push("");

  if (ctx.trainingForRace && ctx.raceType) {
    lines.push(`Training for: ${formatRaceType(ctx.raceType)}`);
    if (ctx.raceDate) {
      const weeksOut = getWeeksUntilRace(ctx.raceDate);
      lines.push(`Race date: ${ctx.raceDate} (${weeksOut} weeks out)`);
    }
    if (ctx.goalTime) lines.push(`Goal time: ${ctx.goalTime}`);
    lines.push("");
  }

  if (ctx.doesCardio && ctx.cardioTypes.length > 0 && !ctx.trainingForRace) {
    lines.push(`Also does cardio: ${ctx.cardioTypes.join(", ")}`);
    lines.push("");
  }

  lines.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`);

  return lines.join("\n");
}

function formatGoal(goal: string): string {
  const map: Record<string, string> = {
    gain_muscle: "Gain muscle",
    lose_weight: "Lose weight / cut",
    maintain: "Maintain / recomp",
    other: "General fitness",
  };
  return map[goal] || goal;
}

function formatRaceType(raceType: string): string {
  const map: Record<string, string> = {
    "5k": "5K",
    "10k": "10K",
    half_marathon: "Half Marathon",
    marathon: "Marathon",
    ultra: "Ultra Marathon",
    sprint_tri: "Sprint Triathlon",
    olympic_tri: "Olympic Triathlon",
    half_ironman: "Half Ironman (70.3)",
    ironman: "Full Ironman (140.6)",
    other: "Other race",
  };
  return map[raceType] || raceType;
}

function getWeeksUntilRace(raceDateStr: string): number {
  const raceDate = new Date(raceDateStr);
  const now = new Date();
  const diffMs = raceDate.getTime() - now.getTime();
  return Math.max(0, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/training/schemas.ts src/lib/training/prompts.ts __tests__/lib/training/schemas.test.ts
git commit -m "feat: add plan generation schemas and prompt builders"
```

---

## Task 3: Plan Generation Server Action

**Files:**
- Create: `src/lib/training/generate-plan.ts`
- Create: `src/app/actions/training.ts`
- Test: `__tests__/lib/training/generate-plan.test.ts`

- [ ] **Step 1: Write plan generation tests**

```typescript
// __tests__/lib/training/generate-plan.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePlannedWorkouts } from "@/lib/training/generate-plan";
import type { DayLayout } from "@/lib/training/schemas";

describe("generatePlannedWorkouts", () => {
  it("generates 4 weeks of planned workouts from a weekly layout", () => {
    const layout: DayLayout[] = [
      { day_of_week: 0, session_type: "Push", ai_notes: null },
      { day_of_week: 1, session_type: "Pull", ai_notes: null },
      { day_of_week: 2, session_type: "Legs", ai_notes: null },
      { day_of_week: 3, session_type: "Rest", ai_notes: null },
      { day_of_week: 4, session_type: "Push", ai_notes: null },
      { day_of_week: 5, session_type: "Pull", ai_notes: null },
      { day_of_week: 6, session_type: "Rest", ai_notes: null },
    ];

    const startDate = new Date("2026-05-04"); // a Monday
    const workouts = generatePlannedWorkouts("plan-123", layout, startDate, 4);

    expect(workouts).toHaveLength(28); // 7 days x 4 weeks
    expect(workouts[0].plan_id).toBe("plan-123");
    expect(workouts[0].date).toBe("2026-05-04");
    expect(workouts[0].day_of_week).toBe(0);
    expect(workouts[0].session_type).toBe("Push");
    expect(workouts[0].status).toBe("scheduled");
    expect(workouts[0].approved).toBe(true);

    // Second week starts on Monday May 11
    expect(workouts[7].date).toBe("2026-05-11");
    expect(workouts[7].session_type).toBe("Push");
  });

  it("calculates correct dates for each day of the week", () => {
    const layout: DayLayout[] = [
      { day_of_week: 0, session_type: "Upper", ai_notes: null },
      { day_of_week: 1, session_type: "Rest", ai_notes: null },
      { day_of_week: 2, session_type: "Lower", ai_notes: null },
      { day_of_week: 3, session_type: "Rest", ai_notes: null },
      { day_of_week: 4, session_type: "Upper", ai_notes: null },
      { day_of_week: 5, session_type: "Lower", ai_notes: null },
      { day_of_week: 6, session_type: "Rest", ai_notes: null },
    ];

    const startDate = new Date("2026-05-04"); // Monday
    const workouts = generatePlannedWorkouts("plan-1", layout, startDate, 1);

    expect(workouts[0].date).toBe("2026-05-04"); // Mon
    expect(workouts[1].date).toBe("2026-05-05"); // Tue
    expect(workouts[2].date).toBe("2026-05-06"); // Wed
    expect(workouts[3].date).toBe("2026-05-07"); // Thu
    expect(workouts[4].date).toBe("2026-05-08"); // Fri
    expect(workouts[5].date).toBe("2026-05-09"); // Sat
    expect(workouts[6].date).toBe("2026-05-10"); // Sun
  });

  it("preserves ai_notes from layout", () => {
    const layout: DayLayout[] = Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      session_type: i === 0 ? "Push" : "Rest",
      ai_notes: i === 0 ? "Go heavy today" : null,
    }));

    const workouts = generatePlannedWorkouts("plan-1", layout, new Date("2026-05-04"), 1);
    expect(workouts[0].ai_notes).toBe("Go heavy today");
    expect(workouts[1].ai_notes).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/lib/training/generate-plan.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement plan generation logic**

```typescript
// src/lib/training/generate-plan.ts
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServerClient } from "@/lib/supabase/server";
import { planGenerationSchema, type PlanGeneration, type DayLayout } from "./schemas";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "./prompts";

interface GeneratePlanInput {
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
}

export function generatePlannedWorkouts(
  planId: string,
  layout: DayLayout[],
  startDate: Date,
  weeks: number,
): Array<{
  plan_id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  status: string;
  approved: boolean;
}> {
  const workouts: Array<{
    plan_id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    status: string;
    approved: boolean;
  }> = [];

  for (let week = 0; week < weeks; week++) {
    for (const day of layout) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + week * 7 + day.day_of_week);
      const dateStr = date.toISOString().slice(0, 10);

      workouts.push({
        plan_id: planId,
        date: dateStr,
        day_of_week: day.day_of_week,
        session_type: day.session_type,
        ai_notes: day.ai_notes,
        status: "scheduled",
        approved: true,
      });
    }
  }

  return workouts;
}

export async function generateTrainingPlan(input: GeneratePlanInput): Promise<{
  plan: PlanGeneration;
  planId: string;
}> {
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
  });

  const { object: plan } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: planGenerationSchema,
    system: PLAN_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  const supabase = createServerClient();

  // Deactivate any existing active plan
  await supabase
    .from("training_plans")
    .update({ status: "completed" })
    .eq("user_id", input.userId)
    .eq("status", "active");

  // Insert new plan
  const { data: newPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: input.userId,
      split_type: plan.split_type,
      body_goal: input.goals.body_goal,
      race_type: input.goals.race_type,
      status: "active",
      plan_config: plan.plan_config as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (planError || !newPlan) throw new Error("Failed to create training plan");

  // Generate 4 weeks of planned workouts starting next Monday
  const nextMonday = getNextMonday();
  const workouts = generatePlannedWorkouts(newPlan.id, plan.weekly_layout, nextMonday, 4);

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts);

  if (workoutsError) throw new Error("Failed to create planned workouts");

  return { plan, planId: newPlan.id };
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sunday, 1=Monday, ...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- __tests__/lib/training/generate-plan.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Create server actions**

```typescript
// src/app/actions/training.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateTrainingPlan } from "@/lib/training/generate-plan";
import type { OnboardingData } from "@/lib/onboarding/types";

export async function generatePlanFromOnboarding(data: OnboardingData) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  try {
    const { plan, planId } = await generateTrainingPlan({
      userId,
      profile: {
        age: data.age,
        height: data.height,
        weight: data.weight,
        sex: data.sex,
        training_experience: data.experience,
      },
      goals: {
        body_goal: data.bodyGoal!,
        emphasis: data.emphasis,
        days_per_week: data.daysPerWeek!,
        lifting_days: data.liftingDays,
        training_for_race: data.trainingForRace,
        race_type: data.raceType,
        race_date: data.raceDate,
        goal_time: data.goalTime,
        does_cardio: data.doesCardio,
        cardio_types: data.cardioTypes,
      },
    });

    return {
      success: true,
      plan: {
        id: planId,
        split_type: plan.split_type,
        reasoning: plan.reasoning,
        weekly_layout: plan.weekly_layout,
        plan_config: plan.plan_config,
      },
    };
  } catch (err) {
    console.error("Plan generation failed:", err);
    return { success: false, error: "Failed to generate training plan" };
  }
}

export async function regeneratePlan() {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: goals } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile || !goals) {
    return { success: false, error: "Profile or goals not found" };
  }

  try {
    const { plan, planId } = await generateTrainingPlan({
      userId,
      profile: {
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        sex: profile.sex,
        training_experience: profile.training_experience,
      },
      goals: {
        body_goal: goals.body_goal,
        emphasis: goals.emphasis,
        days_per_week: goals.days_per_week,
        lifting_days: goals.lifting_days,
        training_for_race: goals.training_for_race,
        race_type: goals.race_type,
        race_date: goals.race_date,
        goal_time: goals.goal_time,
        does_cardio: goals.does_cardio,
        cardio_types: goals.cardio_types,
      },
    });

    return {
      success: true,
      plan: {
        id: planId,
        split_type: plan.split_type,
        reasoning: plan.reasoning,
        weekly_layout: plan.weekly_layout,
        plan_config: plan.plan_config,
      },
    };
  } catch (err) {
    console.error("Plan regeneration failed:", err);
    return { success: false, error: "Failed to regenerate training plan" };
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/training/generate-plan.ts src/app/actions/training.ts __tests__/lib/training/generate-plan.test.ts
git commit -m "feat: add AI plan generation with Claude structured output"
```

---

## Task 4: Rewrite Onboarding Split Result Step

**Files:**
- Modify: `src/components/onboarding/step-split-result.tsx`

- [ ] **Step 1: Rewrite step-split-result.tsx**

Read the existing file first, then replace its entire content with:

```tsx
// src/components/onboarding/step-split-result.tsx
"use client";

import { useState, useEffect } from "react";
import type { OnboardingData } from "@/lib/onboarding/types";
import { generatePlanFromOnboarding } from "@/app/actions/training";
import type { DayLayout } from "@/lib/training/schemas";

interface StepSplitResultProps {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SESSION_COLORS: Record<string, string> = {
  Rest: "bg-gray-50 text-gray-400",
  Push: "bg-green-50 text-green-700",
  Pull: "bg-green-50 text-green-700",
  Legs: "bg-green-50 text-green-700",
  "Upper Body": "bg-green-50 text-green-700",
  "Lower Body": "bg-green-50 text-green-700",
  "Full Body": "bg-green-50 text-green-700",
  "Chest + Back": "bg-green-50 text-green-700",
  "Shoulders + Arms": "bg-green-50 text-green-700",
};

function getSessionColor(sessionType: string): string {
  if (SESSION_COLORS[sessionType]) return SESSION_COLORS[sessionType];
  if (sessionType.toLowerCase().includes("run") || sessionType.toLowerCase().includes("ride")) {
    return "bg-blue-50 text-blue-700";
  }
  if (sessionType.toLowerCase().includes("swim")) {
    return "bg-indigo-50 text-indigo-700";
  }
  return "bg-white text-gray-700";
}

export function StepSplitResult({ data }: StepSplitResultProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    split_type: string;
    reasoning: string;
    weekly_layout: DayLayout[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      setLoading(true);
      setError(null);

      const res = await generatePlanFromOnboarding(data);

      if (cancelled) return;

      if (res.success && res.plan) {
        setResult({
          split_type: res.plan.split_type,
          reasoning: res.plan.reasoning,
          weekly_layout: res.plan.weekly_layout,
        });
      } else {
        setError(res.error || "Failed to generate plan");
      }
      setLoading(false);
    }

    generate();
    return () => { cancelled = true; };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
        <p className="text-lg font-medium">Generating your personalized plan...</p>
        <p className="text-sm text-gray-500">Our AI coach is analyzing your goals and preferences</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => setLoading(true)}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const splitName = result.split_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your AI-Generated Plan</h2>
        <p className="mt-1 text-gray-500">Personalized by our AI coach based on your goals.</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-xl font-bold">{splitName}</h3>
        <p className="mt-2 text-gray-600">{result.reasoning}</p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-500">Your Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {result.weekly_layout.map((day, i) => (
            <div
              key={i}
              className={`flex flex-col items-center rounded-lg border p-3 ${getSessionColor(day.session_type)}`}
            >
              <span className="text-xs text-gray-500">{dayNames[day.day_of_week]}</span>
              <span className="mt-1 text-center text-xs font-medium">{day.session_type}</span>
              {day.ai_notes && (
                <span className="mt-1 text-center text-[10px] italic text-gray-400">{day.ai_notes}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests to check for regressions**

Run: `npm test`
Expected: All tests pass (some onboarding tests may reference the old `recommendSplit` — update them in the next step if needed)

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/step-split-result.tsx
git commit -m "feat: replace hardcoded split with AI-generated plan in onboarding"
```

---

## Task 5: Plan API Routes

**Files:**
- Create: `src/app/api/plan/route.ts`
- Create: `src/app/api/plan/check-in/route.ts`

- [ ] **Step 1: Create plan data API route**

```typescript
// src/app/api/plan/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekOffset = parseInt(searchParams.get("weekOffset") || "0", 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get active plan
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!plan) {
    return NextResponse.json({ plan: null, workouts: [], completions: {} });
  }

  // Calculate week start (Monday) with offset
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);

  // Get planned workouts for the week
  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("plan_id", plan.id)
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date");

  // Get completed workout logs (Hevy)
  const { data: workoutLogs } = await supabase
    .from("workout_logs")
    .select("date, name, duration_minutes, exercises")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  // Get completed cardio logs (Strava)
  const { data: cardioLogs } = await supabase
    .from("cardio_logs")
    .select("date, type, distance, duration, avg_hr, pace_or_speed, calories")
    .eq("user_id", userId)
    .gte("date", startStr)
    .lte("date", endStr);

  // Get recovery data for today (Garmin)
  const todayStr = now.toISOString().slice(0, 10);
  const { data: todayRecovery } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours, resting_hr, body_battery")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .single();

  // Build completions map: date -> { workout?: {...}, cardio?: [...] }
  const completions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }> = {};

  for (const log of workoutLogs || []) {
    if (!completions[log.date]) completions[log.date] = {};
    const exercises = Array.isArray(log.exercises) ? log.exercises : [];
    completions[log.date].workout = {
      name: log.name,
      duration_minutes: log.duration_minutes,
      exercise_count: exercises.length,
    };
  }

  for (const log of cardioLogs || []) {
    if (!completions[log.date]) completions[log.date] = {};
    if (!completions[log.date].cardio) completions[log.date].cardio = [];
    completions[log.date].cardio!.push({
      type: log.type,
      distance: log.distance,
      duration: log.duration,
      avg_hr: log.avg_hr,
      pace_or_speed: log.pace_or_speed,
    });
  }

  // Calculate week number
  const planStart = new Date(plan.created_at);
  const weekNumber = Math.floor((weekStart.getTime() - planStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  return NextResponse.json({
    plan: {
      id: plan.id,
      split_type: plan.split_type,
      body_goal: plan.body_goal,
      race_type: plan.race_type,
      plan_config: plan.plan_config,
      created_at: plan.created_at,
    },
    workouts: workouts || [],
    completions,
    recovery: todayRecovery,
    weekStart: startStr,
    weekEnd: endStr,
    weekNumber,
  });
}
```

- [ ] **Step 2: Create check-in API route**

```typescript
// src/app/api/plan/check-in/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get most recent pending check-in
  const { data: checkIn } = await supabase
    .from("weekly_check_ins")
    .select("*")
    .eq("user_id", userId)
    .is("user_approved", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ checkIn: checkIn || null });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checkInId, approved } = await request.json() as { checkInId: string; approved: boolean };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Update check-in
  const { error: updateError } = await supabase
    .from("weekly_check_ins")
    .update({ user_approved: approved })
    .eq("id", checkInId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (approved) {
    // Get the check-in to apply the layout
    const { data: checkIn } = await supabase
      .from("weekly_check_ins")
      .select("plan_id, next_week_layout, week_start_date")
      .eq("id", checkInId)
      .single();

    if (checkIn?.next_week_layout) {
      // Mark proposed workouts as approved
      const nextMonday = new Date(checkIn.week_start_date);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);

      await supabase
        .from("planned_workouts")
        .update({ approved: true })
        .eq("plan_id", checkIn.plan_id)
        .gte("date", nextMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10));
    }
  } else {
    // Rejected — delete proposed unapproved workouts for next week
    const { data: checkIn } = await supabase
      .from("weekly_check_ins")
      .select("plan_id, week_start_date")
      .eq("id", checkInId)
      .single();

    if (checkIn) {
      const nextMonday = new Date(checkIn.week_start_date);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextSunday = new Date(nextMonday);
      nextSunday.setDate(nextMonday.getDate() + 6);

      await supabase
        .from("planned_workouts")
        .delete()
        .eq("plan_id", checkIn.plan_id)
        .eq("approved", false)
        .gte("date", nextMonday.toISOString().slice(0, 10))
        .lte("date", nextSunday.toISOString().slice(0, 10));
    }
  }

  return NextResponse.json({ status: approved ? "approved" : "rejected" });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/plan/route.ts src/app/api/plan/check-in/route.ts
git commit -m "feat: add plan data and check-in approval API routes"
```

---

## Task 6: Plan UI Components — DayCard + WeekStrip

**Files:**
- Create: `src/components/plan/day-card.tsx`
- Create: `src/components/plan/week-strip.tsx`
- Test: `__tests__/components/plan/day-card.test.tsx`
- Test: `__tests__/components/plan/week-strip.test.tsx`

- [ ] **Step 1: Write DayCard tests**

```typescript
// __tests__/components/plan/day-card.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DayCard } from "@/components/plan/day-card";

describe("DayCard", () => {
  it("renders a scheduled session", () => {
    render(
      <DayCard
        dayName="Mon"
        dateStr="May 4"
        sessionType="Push"
        status="scheduled"
        isToday={false}
        aiNotes={null}
        completion={null}
      />,
    );
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("renders today with highlight and AI notes", () => {
    render(
      <DayCard
        dayName="Fri"
        dateStr="May 2"
        sessionType="Upper Body"
        status="scheduled"
        isToday={true}
        aiNotes="HRV 52, sleep 7.8h — push hard"
        completion={null}
      />,
    );
    expect(screen.getByText("Today")).toBeDefined();
    expect(screen.getByText("HRV 52, sleep 7.8h — push hard")).toBeDefined();
  });

  it("renders completed lifting session with Hevy data", () => {
    render(
      <DayCard
        dayName="Mon"
        dateStr="Apr 28"
        sessionType="Push"
        status="completed"
        isToday={false}
        aiNotes={null}
        completion={{ workout: { name: "Push Day", duration_minutes: 72, exercise_count: 10 } }}
      />,
    );
    expect(screen.getByText("72 min")).toBeDefined();
    expect(screen.getByText(/10 exercises/)).toBeDefined();
  });

  it("renders completed cardio with Strava data", () => {
    render(
      <DayCard
        dayName="Tue"
        dateStr="Apr 29"
        sessionType="Tempo Run"
        status="completed"
        isToday={false}
        aiNotes={null}
        completion={{ cardio: [{ type: "run", distance: 8.2, duration: 2355, avg_hr: 168, pace_or_speed: 4.79 }] }}
      />,
    );
    expect(screen.getByText("8.2 km")).toBeDefined();
    expect(screen.getByText(/168 bpm/)).toBeDefined();
  });

  it("renders rest day", () => {
    render(
      <DayCard
        dayName="Sun"
        dateStr="May 4"
        sessionType="Rest"
        status="scheduled"
        isToday={false}
        aiNotes={null}
        completion={null}
      />,
    );
    expect(screen.getByText("Rest")).toBeDefined();
    expect(screen.getByText("Recovery day")).toBeDefined();
  });

  it("renders missed session", () => {
    render(
      <DayCard
        dayName="Wed"
        dateStr="Apr 30"
        sessionType="Legs"
        status="missed"
        isToday={false}
        aiNotes={null}
        completion={null}
      />,
    );
    expect(screen.getByText("Missed")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- __tests__/components/plan/day-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement DayCard**

```tsx
// src/components/plan/day-card.tsx
"use client";

interface Completion {
  workout?: { name: string; duration_minutes: number; exercise_count: number };
  cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
}

interface DayCardProps {
  dayName: string;
  dateStr: string;
  sessionType: string;
  status: "scheduled" | "completed" | "missed";
  isToday: boolean;
  aiNotes: string | null;
  completion: Completion | null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatPace(paceMinPerKm: number): string {
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function getSessionBadgeColor(sessionType: string): string {
  const lower = sessionType.toLowerCase();
  if (sessionType === "Rest") return "bg-gray-100 text-gray-500";
  if (lower.includes("tempo") || lower.includes("long") || lower.includes("brick") || lower.includes("interval")) {
    return "bg-amber-50 text-amber-700";
  }
  if (lower.includes("run") || lower.includes("ride")) return "bg-blue-50 text-blue-700";
  if (lower.includes("swim")) return "bg-indigo-50 text-indigo-700";
  return "bg-green-50 text-green-700"; // lifting
}

function getBorderColor(status: string, isToday: boolean): string {
  if (isToday) return "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";
  if (status === "completed") return "border-green-500";
  if (status === "missed") return "border-red-300 bg-red-50/30";
  return "border-gray-200";
}

export function DayCard({ dayName, dateStr, sessionType, status, isToday, aiNotes, completion }: DayCardProps) {
  const isRest = sessionType === "Rest";
  const borderColor = getBorderColor(status, isToday);
  const sessions = sessionType.split(" + ");

  return (
    <div className={`flex flex-col items-center rounded-xl border-2 p-3 bg-white ${borderColor}`}>
      {/* Day label */}
      <div className={`text-[11px] font-semibold uppercase ${isToday ? "text-blue-600 font-bold" : "text-gray-500"}`}>
        {isToday ? "Today" : dayName}
      </div>
      <div className="text-[13px] text-gray-400">{dateStr}</div>

      {/* Session badges */}
      <div className="mt-2 flex flex-col items-center gap-1">
        {sessions.map((s, i) => (
          <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSessionBadgeColor(s.trim())}`}>
            {s.trim()}
          </span>
        ))}
      </div>

      {/* Status / completion data */}
      <div className="mt-2 text-center">
        {status === "completed" && (
          <>
            <div className="text-green-500 text-base">✓</div>
            {completion?.workout && (
              <div className="text-[10px] text-gray-600 leading-relaxed">
                <div>{completion.workout.duration_minutes} min</div>
                <div>{completion.workout.exercise_count} exercises</div>
              </div>
            )}
            {completion?.cardio?.map((c, i) => (
              <div key={i} className="text-[10px] text-blue-600 leading-relaxed">
                <div>{c.distance} km</div>
                {c.pace_or_speed && <div>{formatPace(c.pace_or_speed)}</div>}
                {c.avg_hr && <div>{c.avg_hr} bpm</div>}
              </div>
            ))}
          </>
        )}

        {status === "missed" && (
          <span className="text-[11px] font-medium text-red-500">Missed</span>
        )}

        {status === "scheduled" && !isRest && (
          <span className="text-[11px] text-gray-500">Scheduled</span>
        )}

        {isRest && (
          <>
            <div className="text-gray-300 text-lg">—</div>
            <span className="text-[10px] text-gray-400">Recovery day</span>
          </>
        )}
      </div>

      {/* AI notes */}
      {aiNotes && (
        <div className="mt-1 text-[10px] text-blue-500 italic text-center leading-tight">
          {aiNotes}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run DayCard tests**

Run: `npm test -- __tests__/components/plan/day-card.test.tsx`
Expected: 6 tests PASS

- [ ] **Step 5: Write WeekStrip tests**

```typescript
// __tests__/components/plan/week-strip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekStrip } from "@/components/plan/week-strip";

describe("WeekStrip", () => {
  const baseWorkouts = [
    { id: "1", date: "2026-05-04", day_of_week: 0, session_type: "Push", ai_notes: null, status: "scheduled", approved: true },
    { id: "2", date: "2026-05-05", day_of_week: 1, session_type: "Pull", ai_notes: null, status: "scheduled", approved: true },
    { id: "3", date: "2026-05-06", day_of_week: 2, session_type: "Legs", ai_notes: null, status: "scheduled", approved: true },
    { id: "4", date: "2026-05-07", day_of_week: 3, session_type: "Rest", ai_notes: null, status: "scheduled", approved: true },
    { id: "5", date: "2026-05-08", day_of_week: 4, session_type: "Push", ai_notes: null, status: "scheduled", approved: true },
    { id: "6", date: "2026-05-09", day_of_week: 5, session_type: "Pull", ai_notes: null, status: "scheduled", approved: true },
    { id: "7", date: "2026-05-10", day_of_week: 6, session_type: "Rest", ai_notes: null, status: "scheduled", approved: true },
  ];

  it("renders 7 day cards", () => {
    render(
      <WeekStrip
        workouts={baseWorkouts}
        completions={{}}
        weekStart="2026-05-04"
        today="2026-05-08"
      />,
    );
    expect(screen.getByText("Mon")).toBeDefined();
    expect(screen.getByText("Sun")).toBeDefined();
    expect(screen.getAllByText("Push")).toHaveLength(2);
  });

  it("marks today correctly", () => {
    render(
      <WeekStrip
        workouts={baseWorkouts}
        completions={{}}
        weekStart="2026-05-04"
        today="2026-05-08"
      />,
    );
    expect(screen.getByText("Today")).toBeDefined();
  });
});
```

- [ ] **Step 6: Implement WeekStrip**

```tsx
// src/components/plan/week-strip.tsx
"use client";

import { DayCard } from "./day-card";

interface Workout {
  id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  status: string;
  approved: boolean;
}

interface Completion {
  workout?: { name: string; duration_minutes: number; exercise_count: number };
  cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
}

interface WeekStripProps {
  workouts: Workout[];
  completions: Record<string, Completion>;
  weekStart: string;
  today: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatus(workout: Workout, dateStr: string, today: string, completion: Completion | undefined): "scheduled" | "completed" | "missed" {
  if (completion?.workout || completion?.cardio) return "completed";
  if (workout.session_type === "Rest") return "scheduled";
  if (dateStr < today && workout.status === "scheduled") return "missed";
  return "scheduled";
}

export function WeekStrip({ workouts, completions, weekStart, today }: WeekStripProps) {
  // Build a map of date -> workout
  const workoutByDate: Record<string, Workout> = {};
  for (const w of workouts) {
    workoutByDate[w.date] = w;
  }

  // Generate 7 days starting from weekStart
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((dateStr, i) => {
        const workout = workoutByDate[dateStr];
        const completion = completions[dateStr];

        if (!workout) {
          return (
            <DayCard
              key={dateStr}
              dayName={DAY_NAMES[i]}
              dateStr={formatDateShort(dateStr)}
              sessionType="Rest"
              status="scheduled"
              isToday={dateStr === today}
              aiNotes={null}
              completion={null}
            />
          );
        }

        const status = getStatus(workout, dateStr, today, completion);

        return (
          <DayCard
            key={dateStr}
            dayName={DAY_NAMES[i]}
            dateStr={formatDateShort(dateStr)}
            sessionType={workout.session_type}
            status={status}
            isToday={dateStr === today}
            aiNotes={workout.ai_notes}
            completion={completion || null}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Run WeekStrip tests**

Run: `npm test -- __tests__/components/plan/week-strip.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/plan/day-card.tsx src/components/plan/week-strip.tsx __tests__/components/plan/day-card.test.tsx __tests__/components/plan/week-strip.test.tsx
git commit -m "feat: add DayCard and WeekStrip components for training plan view"
```

---

## Task 7: Plan Header + Adjustment Banner Components

**Files:**
- Create: `src/components/plan/plan-header.tsx`
- Create: `src/components/plan/adjustment-banner.tsx`
- Create: `src/components/plan/adjustment-review.tsx`
- Test: `__tests__/components/plan/adjustment-banner.test.tsx`

- [ ] **Step 1: Write adjustment banner test**

```typescript
// __tests__/components/plan/adjustment-banner.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdjustmentBanner } from "@/components/plan/adjustment-banner";

describe("AdjustmentBanner", () => {
  it("renders pending adjustment with summary", () => {
    render(
      <AdjustmentBanner
        checkIn={{
          id: "ci-1",
          ai_summary: "Your HRV has been trending down. I suggest reducing volume by 15%.",
          risk_flags: ["Sleep averaging 6.2h"],
          adjustments: [{ type: "volume", description: "Reduce volume 15%", affected_days: [0, 2, 4] }],
        }}
        onReview={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/HRV has been trending down/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Review Changes/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Dismiss/i })).toBeDefined();
  });

  it("returns null when no check-in", () => {
    const { container } = render(
      <AdjustmentBanner checkIn={null} onReview={() => {}} onDismiss={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL. Then implement components.**

```tsx
// src/components/plan/plan-header.tsx
"use client";

interface PlanHeaderProps {
  splitType: string;
  bodyGoal: string | null;
  raceType: string | null;
  planConfig: Record<string, unknown> | null;
  weekNumber: number;
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push / Pull / Legs",
  arnold: "Arnold Split",
  upper_lower: "Upper / Lower",
  full_body: "Full Body",
  phul: "PHUL",
  bro_split: "Bro Split",
  hybrid_upper_lower: "Upper/Lower + Race Prep",
  hybrid_nick_bare: "Hybrid (Nick Bare Style)",
};

const GOAL_LABELS: Record<string, string> = {
  gain_muscle: "Muscle Gain",
  lose_weight: "Fat Loss",
  maintain: "Maintain",
};

export function PlanHeader({
  splitType,
  bodyGoal,
  raceType,
  planConfig,
  weekNumber,
  weekOffset,
  onPrev,
  onNext,
  onToday,
}: PlanHeaderProps) {
  const name = SPLIT_LABELS[splitType] || splitType;
  const goal = bodyGoal ? GOAL_LABELS[bodyGoal] || bodyGoal : null;
  const phase = planConfig?.periodization_phase as string | undefined;
  const raceWeeksOut = planConfig?.race_weeks_out as number | undefined;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold">{name}</h1>
        <p className="text-sm text-gray-500">
          {raceType && raceWeeksOut !== undefined && (
            <>
              {raceType.replace(/_/g, " ")} · {phase ? `${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase` : ""} ·{" "}
              <span className="font-semibold text-amber-600">Race in {raceWeeksOut} weeks</span>
            </>
          )}
          {!raceType && goal && (
            <>{goal} · Week {weekNumber}</>
          )}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onPrev} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Prev
        </button>
        <button
          onClick={onToday}
          className={`rounded-lg border px-3 py-1.5 text-sm ${weekOffset === 0 ? "font-semibold" : "hover:bg-gray-50"}`}
        >
          This Week
        </button>
        <button onClick={onNext} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
          Next →
        </button>
      </div>
    </div>
  );
}
```

```tsx
// src/components/plan/adjustment-banner.tsx
"use client";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface CheckIn {
  id: string;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Adjustment[] | null;
}

interface AdjustmentBannerProps {
  checkIn: CheckIn | null;
  onReview: () => void;
  onDismiss: () => void;
}

export function AdjustmentBanner({ checkIn, onReview, onDismiss }: AdjustmentBannerProps) {
  if (!checkIn) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="text-xl">💡</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">Weekly Check-in: Plan Adjustment Suggested</p>
        <p className="mt-1 text-sm text-stone-600">{checkIn.ai_summary}</p>
        {checkIn.risk_flags && checkIn.risk_flags.length > 0 && (
          <div className="mt-2 space-y-1">
            {checkIn.risk_flags.map((flag, i) => (
              <p key={i} className="text-xs text-red-600">⚠ {flag}</p>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onReview}
            className="rounded-lg bg-black px-4 py-1.5 text-sm font-semibold text-white"
          >
            Review Changes
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border px-4 py-1.5 text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/plan/adjustment-review.tsx
"use client";

import { useState } from "react";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface AdjustmentReviewProps {
  checkInId: string;
  summary: string;
  adjustments: Adjustment[];
  riskFlags: string[];
  open: boolean;
  onClose: () => void;
  onApprove: (checkInId: string) => Promise<void>;
  onReject: (checkInId: string) => Promise<void>;
}

export function AdjustmentReview({
  checkInId,
  summary,
  adjustments,
  riskFlags,
  open,
  onClose,
  onApprove,
  onReject,
}: AdjustmentReviewProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(checkInId);
    setLoading(false);
    onClose();
  };

  const handleReject = async () => {
    setLoading(true);
    await onReject(checkInId);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Review Plan Adjustments</h3>
        <p className="mt-2 text-sm text-gray-600">{summary}</p>

        {adjustments.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Proposed changes:</p>
            {adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{adj.type}</span>
                <p className="text-sm text-gray-700">{adj.description}</p>
              </div>
            ))}
          </div>
        )}

        {riskFlags.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-red-700">Risk flags:</p>
            {riskFlags.map((flag, i) => (
              <p key={i} className="text-sm text-red-600">⚠ {flag}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleReject}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            disabled={loading}
          >
            Reject Changes
          </button>
          <button
            onClick={handleApprove}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Applying..." : "Approve Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- __tests__/components/plan/adjustment-banner.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/plan/plan-header.tsx src/components/plan/adjustment-banner.tsx src/components/plan/adjustment-review.tsx __tests__/components/plan/adjustment-banner.test.tsx
git commit -m "feat: add plan header, adjustment banner, and review modal components"
```

---

## Task 8: Rewrite Plan Page

**Files:**
- Modify: `src/app/dashboard/plan/page.tsx`

- [ ] **Step 1: Read the existing file, then replace with:**

```tsx
// src/app/dashboard/plan/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { PlanHeader } from "@/components/plan/plan-header";
import { WeekStrip } from "@/components/plan/week-strip";
import { AdjustmentBanner } from "@/components/plan/adjustment-banner";
import { AdjustmentReview } from "@/components/plan/adjustment-review";

interface PlanData {
  plan: {
    id: string;
    split_type: string;
    body_goal: string | null;
    race_type: string | null;
    plan_config: Record<string, unknown> | null;
    created_at: string;
  } | null;
  workouts: Array<{
    id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    status: string;
    approved: boolean;
  }>;
  completions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }>;
  recovery: { hrv: number | null; sleep_hours: number | null; resting_hr: number | null } | null;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
}

interface CheckIn {
  id: string;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Array<{ type: string; description: string; affected_days: number[] }> | null;
}

export default function PlanPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<PlanData | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/plan?weekOffset=${weekOffset}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, [weekOffset]);

  const fetchCheckIn = useCallback(async () => {
    const res = await fetch("/api/plan/check-in");
    if (res.ok) {
      const json = await res.json();
      setCheckIn(json.checkIn);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
    fetchCheckIn();
  }, [fetchPlan, fetchCheckIn]);

  const handleApprove = async (checkInId: string) => {
    await fetch("/api/plan/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId, approved: true }),
    });
    setCheckIn(null);
    fetchPlan();
  };

  const handleReject = async (checkInId: string) => {
    await fetch("/api/plan/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId, approved: false }),
    });
    setCheckIn(null);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <div>
        <h1 className="text-2xl font-bold">My Plan</h1>
        <p className="mt-2 text-gray-500">
          Complete onboarding to generate your training plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlanHeader
        splitType={data.plan.split_type}
        bodyGoal={data.plan.body_goal}
        raceType={data.plan.race_type}
        planConfig={data.plan.plan_config}
        weekNumber={data.weekNumber}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        onToday={() => setWeekOffset(0)}
      />

      <WeekStrip
        workouts={data.workouts}
        completions={data.completions}
        weekStart={data.weekStart}
        today={today}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {[
          { color: "bg-green-50 border-green-500", label: "Lifting (Hevy)" },
          { color: "bg-blue-50 border-blue-500", label: "Run (Strava)" },
          { color: "bg-indigo-50 border-indigo-500", label: "Swim (Strava)" },
          { color: "bg-amber-50 border-amber-500", label: "Key Session" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`inline-block h-2.5 w-2.5 rounded border ${color}`} />
            {label}
          </div>
        ))}
      </div>

      <AdjustmentBanner
        checkIn={checkIn}
        onReview={() => setReviewOpen(true)}
        onDismiss={() => setCheckIn(null)}
      />

      {checkIn && (
        <AdjustmentReview
          checkInId={checkIn.id}
          summary={checkIn.ai_summary}
          adjustments={checkIn.adjustments || []}
          riskFlags={checkIn.risk_flags || []}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/plan/page.tsx
git commit -m "feat: rewrite plan page with weekly view, completion matching, and adjustment review"
```

---

## Task 9: Weekly Auto-Adjustment — Data Gathering

**Files:**
- Create: `server/src/adjustment/gather-data.ts`
- Test: `server/__tests__/adjustment/gather-data.test.ts`

- [ ] **Step 1: Write data gathering tests**

```typescript
// server/__tests__/adjustment/gather-data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCompliance } from "../../src/adjustment/gather-data.js";

describe("gather-data", () => {
  describe("computeCompliance", () => {
    it("calculates 100% when all non-rest sessions are completed", () => {
      const planned = [
        { session_type: "Push", status: "completed" },
        { session_type: "Pull", status: "completed" },
        { session_type: "Legs", status: "completed" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(100);
    });

    it("calculates 50% when half sessions are completed", () => {
      const planned = [
        { session_type: "Push", status: "completed" },
        { session_type: "Pull", status: "scheduled" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(50);
    });

    it("returns 100 for rest-only weeks", () => {
      const planned = [
        { session_type: "Rest", status: "scheduled" },
        { session_type: "Rest", status: "scheduled" },
      ];
      expect(computeCompliance(planned)).toBe(100);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL. Then implement:**

```typescript
// server/src/adjustment/gather-data.ts
import { supabase } from "../db.js";

interface PlannedWorkout {
  session_type: string;
  status: string;
}

export function computeCompliance(planned: PlannedWorkout[]): number {
  const nonRest = planned.filter((p) => p.session_type !== "Rest");
  if (nonRest.length === 0) return 100;
  const completed = nonRest.filter((p) => p.status === "completed");
  return Math.round((completed.length / nonRest.length) * 100);
}

export interface WeekData {
  planned: Array<{ date: string; session_type: string; status: string; day_of_week: number }>;
  workoutLogs: Array<{ date: string; name: string; duration_minutes: number; exercises: unknown }>;
  cardioLogs: Array<{ date: string; type: string; distance: number; duration: number; avg_hr: number | null }>;
  nutritionLogs: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number }>;
  recoveryLogs: Array<{ date: string; hrv: number | null; sleep_hours: number | null; resting_hr: number | null; body_battery: number | null; stress_level: number | null }>;
  compliance: number;
  avgCalories: number;
  avgProtein: number;
  avgSleepHours: number | null;
  avgHrv: number | null;
}

export async function gatherWeekData(userId: string, planId: string, weekStartDate: string): Promise<WeekData> {
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const [plannedRes, workoutRes, cardioRes, nutritionRes, recoveryRes] = await Promise.all([
    supabase
      .from("planned_workouts")
      .select("date, session_type, status, day_of_week")
      .eq("plan_id", planId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("workout_logs")
      .select("date, name, duration_minutes, exercises")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("cardio_logs")
      .select("date, type, distance, duration, avg_hr")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("nutrition_logs")
      .select("date, calories, protein, carbs, fat")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
    supabase
      .from("recovery_logs")
      .select("date, hrv, sleep_hours, resting_hr, body_battery, stress_level")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", endStr),
  ]);

  const planned = plannedRes.data || [];
  const workoutLogs = workoutRes.data || [];
  const cardioLogs = cardioRes.data || [];
  const nutritionLogs = nutritionRes.data || [];
  const recoveryLogs = recoveryRes.data || [];

  // Mark planned workouts as completed if matching logs exist
  const workoutDates = new Set(workoutLogs.map((w) => w.date));
  const cardioDates = new Set(cardioLogs.map((c) => c.date));

  for (const p of planned) {
    if (p.session_type === "Rest") continue;
    const isLifting = !p.session_type.toLowerCase().includes("run") &&
                      !p.session_type.toLowerCase().includes("ride") &&
                      !p.session_type.toLowerCase().includes("swim");
    if (isLifting && workoutDates.has(p.date)) p.status = "completed";
    if (!isLifting && cardioDates.has(p.date)) p.status = "completed";
    // Multi-session: check both
    if (p.session_type.includes("+")) {
      if (workoutDates.has(p.date) || cardioDates.has(p.date)) p.status = "completed";
    }
  }

  const compliance = computeCompliance(planned);

  const avgCalories = nutritionLogs.length > 0
    ? Math.round(nutritionLogs.reduce((s, n) => s + n.calories, 0) / nutritionLogs.length)
    : 0;

  const avgProtein = nutritionLogs.length > 0
    ? Math.round(nutritionLogs.reduce((s, n) => s + n.protein, 0) / nutritionLogs.length)
    : 0;

  const sleepEntries = recoveryLogs.filter((r) => r.sleep_hours !== null);
  const avgSleepHours = sleepEntries.length > 0
    ? Math.round(sleepEntries.reduce((s, r) => s + r.sleep_hours!, 0) / sleepEntries.length * 10) / 10
    : null;

  const hrvEntries = recoveryLogs.filter((r) => r.hrv !== null);
  const avgHrv = hrvEntries.length > 0
    ? Math.round(hrvEntries.reduce((s, r) => s + r.hrv!, 0) / hrvEntries.length)
    : null;

  return {
    planned,
    workoutLogs,
    cardioLogs,
    nutritionLogs,
    recoveryLogs,
    compliance,
    avgCalories,
    avgProtein,
    avgSleepHours,
    avgHrv,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run __tests__/adjustment/gather-data.test.ts`
Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/adjustment/gather-data.ts server/__tests__/adjustment/gather-data.test.ts
git commit -m "feat: add weekly data gathering for auto-adjustment"
```

---

## Task 10: Weekly Auto-Adjustment — Claude Analysis + Cron

**Files:**
- Create: `server/src/adjustment/schemas.ts`
- Create: `server/src/adjustment/weekly-check-in.ts`
- Modify: `server/src/sync/scheduler.ts`
- Modify: `server/src/config.ts`
- Test: `server/__tests__/adjustment/weekly-check-in.test.ts`

- [ ] **Step 1: Write check-in test**

```typescript
// server/__tests__/adjustment/weekly-check-in.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildAdjustmentPrompt } from "../../src/adjustment/weekly-check-in.js";

vi.mock("../../src/db.js", () => ({
  supabase: { from: vi.fn() },
}));

describe("weekly-check-in", () => {
  describe("buildAdjustmentPrompt", () => {
    it("includes compliance and recovery data in prompt", () => {
      const prompt = buildAdjustmentPrompt({
        splitType: "ppl",
        bodyGoal: "gain_muscle",
        raceType: null,
        planConfig: { deload_frequency: 4 },
        weekData: {
          compliance: 83,
          avgCalories: 2400,
          avgProtein: 175,
          avgSleepHours: 6.8,
          avgHrv: 45,
          planned: [],
          workoutLogs: [],
          cardioLogs: [],
          nutritionLogs: [],
          recoveryLogs: [],
        },
      });

      expect(prompt).toContain("83%");
      expect(prompt).toContain("2400");
      expect(prompt).toContain("6.8");
      expect(prompt).toContain("45");
      expect(prompt).toContain("ppl");
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL. Then implement:**

```typescript
// server/src/adjustment/schemas.ts
import { z } from "zod";

const adjustmentSchema = z.object({
  type: z.enum(["volume", "frequency", "intensity", "session_swap", "rest_day", "periodization"]),
  description: z.string(),
  affected_days: z.array(z.number().int().min(0).max(6)),
});

const dayLayoutSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_type: z.string().min(1),
  ai_notes: z.string().nullable(),
});

export const weeklyAdjustmentSchema = z.object({
  summary: z.string(),
  compliance_pct: z.number().int().min(0).max(100),
  adjustments: z.array(adjustmentSchema),
  risk_flags: z.array(z.string()),
  next_week_layout: z.array(dayLayoutSchema).length(7),
});

export type WeeklyAdjustment = z.infer<typeof weeklyAdjustmentSchema>;
```

```typescript
// server/src/adjustment/weekly-check-in.ts
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { supabase } from "../db.js";
import { logger } from "../utils/logger.js";
import { gatherWeekData, type WeekData } from "./gather-data.js";
import { weeklyAdjustmentSchema } from "./schemas.js";
import { getActiveIntegrations } from "../sync/base.js";

const ADJUSTMENT_SYSTEM_PROMPT = `You are a fitness coach analyzing a client's past week and adjusting their plan.
Review their compliance, recovery, nutrition, and performance data.
Propose adjustments for next week. Be specific about what to change and why.
Do not make changes unless the data supports it.

Session type examples:
- Lifting: "Push", "Pull", "Legs", "Upper Body", "Lower Body", "Full Body", "Chest + Back", "Shoulders + Arms"
- Cardio: "Easy Run (Zone 2)", "Tempo Run", "Intervals", "Long Run", "Long Ride", "Swim", "Long Ride + Brick Run"
- Multi-session: "Upper Body + Easy Run (Zone 2)"
- Rest: "Rest"

day_of_week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday`;

interface AdjustmentInput {
  splitType: string;
  bodyGoal: string | null;
  raceType: string | null;
  planConfig: Record<string, unknown> | null;
  weekData: WeekData;
}

export function buildAdjustmentPrompt(input: AdjustmentInput): string {
  const { splitType, bodyGoal, raceType, planConfig, weekData } = input;
  const lines: string[] = [];

  lines.push(`Current split: ${splitType}`);
  if (bodyGoal) lines.push(`Goal: ${bodyGoal}`);
  if (raceType) lines.push(`Training for: ${raceType}`);
  if (planConfig?.periodization_phase) lines.push(`Phase: ${planConfig.periodization_phase}`);
  if (planConfig?.race_weeks_out) lines.push(`Race in ${planConfig.race_weeks_out} weeks`);
  lines.push("");

  lines.push(`=== LAST WEEK SUMMARY ===`);
  lines.push(`Compliance: ${weekData.compliance}%`);
  lines.push(`Avg calories: ${weekData.avgCalories}`);
  lines.push(`Avg protein: ${weekData.avgProtein}g`);
  if (weekData.avgSleepHours !== null) lines.push(`Avg sleep: ${weekData.avgSleepHours}h`);
  if (weekData.avgHrv !== null) lines.push(`Avg HRV: ${weekData.avgHrv}`);
  lines.push("");

  if (weekData.planned.length > 0) {
    lines.push("Planned sessions:");
    for (const p of weekData.planned) {
      lines.push(`  ${p.date} (day ${p.day_of_week}): ${p.session_type} — ${p.status}`);
    }
    lines.push("");
  }

  if (weekData.workoutLogs.length > 0) {
    lines.push("Lifting logs:");
    for (const w of weekData.workoutLogs) {
      const exercises = Array.isArray(w.exercises) ? w.exercises : [];
      lines.push(`  ${w.date}: ${w.name} — ${w.duration_minutes} min, ${exercises.length} exercises`);
    }
    lines.push("");
  }

  if (weekData.cardioLogs.length > 0) {
    lines.push("Cardio logs:");
    for (const c of weekData.cardioLogs) {
      lines.push(`  ${c.date}: ${c.type} — ${c.distance}km, ${Math.round(c.duration / 60)} min${c.avg_hr ? `, ${c.avg_hr} bpm` : ""}`);
    }
    lines.push("");
  }

  if (weekData.recoveryLogs.length > 0) {
    lines.push("Recovery data:");
    for (const r of weekData.recoveryLogs) {
      const parts = [];
      if (r.hrv !== null) parts.push(`HRV ${r.hrv}`);
      if (r.sleep_hours !== null) parts.push(`Sleep ${r.sleep_hours}h`);
      if (r.resting_hr !== null) parts.push(`RHR ${r.resting_hr}`);
      if (r.body_battery !== null) parts.push(`BB ${r.body_battery}`);
      if (parts.length > 0) lines.push(`  ${r.date}: ${parts.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("Generate next week's plan based on this data. Keep the same split structure unless data suggests a change.");

  return lines.join("\n");
}

export async function runWeeklyCheckIn(userId: string, planId: string): Promise<void> {
  // Calculate last week's Monday
  const now = new Date();
  const day = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
  const weekStartDate = lastMonday.toISOString().slice(0, 10);

  // Get plan details
  const { data: plan } = await supabase
    .from("training_plans")
    .select("split_type, body_goal, race_type, plan_config")
    .eq("id", planId)
    .single();

  if (!plan) {
    logger.error("Plan not found for check-in", { planId });
    return;
  }

  const weekData = await gatherWeekData(userId, planId, weekStartDate);

  const prompt = buildAdjustmentPrompt({
    splitType: plan.split_type,
    bodyGoal: plan.body_goal,
    raceType: plan.race_type,
    planConfig: plan.plan_config as Record<string, unknown>,
    weekData,
  });

  const { object: adjustment } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: weeklyAdjustmentSchema,
    system: ADJUSTMENT_SYSTEM_PROMPT,
    prompt,
  });

  // Store check-in
  const { error: insertError } = await supabase
    .from("weekly_check_ins")
    .insert({
      user_id: userId,
      plan_id: planId,
      week_start_date: weekStartDate,
      compliance_pct: adjustment.compliance_pct,
      avg_calories: weekData.avgCalories,
      avg_protein: weekData.avgProtein,
      avg_sleep_hours: weekData.avgSleepHours,
      avg_hrv: weekData.avgHrv,
      ai_summary: adjustment.summary,
      adjustments: adjustment.adjustments,
      risk_flags: adjustment.risk_flags,
      next_week_layout: adjustment.next_week_layout,
      user_approved: null,
    });

  if (insertError) {
    logger.error("Failed to insert check-in", { error: String(insertError) });
    return;
  }

  // Generate proposed workouts for next week (unapproved)
  const nextMonday = new Date(lastMonday);
  nextMonday.setDate(nextMonday.getDate() + 14); // Two Mondays ahead (next week from now)

  const workouts = adjustment.next_week_layout.map((day) => {
    const date = new Date(nextMonday);
    date.setDate(date.getDate() + day.day_of_week);
    return {
      plan_id: planId,
      date: date.toISOString().slice(0, 10),
      day_of_week: day.day_of_week,
      session_type: day.session_type,
      ai_notes: day.ai_notes,
      status: "scheduled",
      approved: false,
    };
  });

  await supabase.from("planned_workouts").insert(workouts);

  logger.info("Weekly check-in completed", { userId, planId, compliance: adjustment.compliance_pct });
}

export async function runAllWeeklyCheckIns(): Promise<void> {
  // Get all users with active plans
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, user_id")
    .eq("status", "active");

  if (!plans || plans.length === 0) {
    logger.info("No active plans for weekly check-in");
    return;
  }

  for (const plan of plans) {
    try {
      await runWeeklyCheckIn(plan.user_id, plan.id);
    } catch (err) {
      logger.error("Weekly check-in failed", { userId: plan.user_id, planId: plan.id, error: String(err) });
    }
  }
}
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to server config**

Read `server/src/config.ts` and add `anthropicApiKey`:

```typescript
// Add to the config object in server/src/config.ts:
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
```

Also add to `server/.env.example`:
```
ANTHROPIC_API_KEY=
```

- [ ] **Step 4: Add weekly check-in cron to scheduler**

Read `server/src/sync/scheduler.ts` and add the Sunday night cron:

Add import at top:
```typescript
import { runAllWeeklyCheckIns } from "../adjustment/weekly-check-in.js";
```

Add inside `startScheduler()`:
```typescript
  // Weekly plan adjustment: Sunday 9 PM UTC
  cron.schedule("0 21 * * 0", () => {
    logger.info("Cron: starting weekly check-ins");
    runAllWeeklyCheckIns().catch((err) => logger.error("Cron: weekly check-in failed", { error: String(err) }));
  });
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run __tests__/adjustment/`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/adjustment/schemas.ts server/src/adjustment/weekly-check-in.ts server/src/adjustment/gather-data.ts server/__tests__/adjustment/weekly-check-in.test.ts server/src/sync/scheduler.ts server/src/config.ts server/.env.example
git commit -m "feat: add weekly auto-adjustment with Claude analysis and Sunday night cron"
```

---

## Task 11: Run All Tests + Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 2: Run all server tests**

Run: `cd /Users/sharans/Desktop/projects/macrofactor-agent/server && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Verify git status is clean**

Run: `git status`
Expected: Nothing to commit, working tree clean

- [ ] **Step 4: Final commit (if any stray changes)**

```bash
git add -A && git commit -m "chore: Phase 4 cleanup" || echo "Nothing to commit"
```
