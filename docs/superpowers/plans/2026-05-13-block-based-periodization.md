# Block-Based Periodization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce training blocks as a first-class concept — structured multi-week periodization that auto-adapts based on race calendar, compliance, and recovery trends.

**Architecture:** New `training_blocks` table sits between `training_plans` and `planned_workouts`. Phase progression is a pure function (race-anchored or cyclical). The coach proposes the next block when the current one nears its end; user accepts via chat. Calendar sidebar shows subtle block indicators.

**Tech Stack:** Supabase (PostgreSQL), Next.js API routes, Vercel AI SDK, Zod schemas, vitest, React inline styles

**Spec:** `docs/superpowers/specs/2026-05-13-block-based-periodization-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/009_training_blocks.sql` | DB schema: `training_blocks` table + `block_id` FK on `planned_workouts` |
| `src/lib/training/phase-rules.ts` | Pure function: determine next block type from race date or cycle position |
| `src/lib/training/blocks.ts` | Block CRUD: create, get active, complete, get compliance |
| `src/lib/chat/tools/propose-next-block.ts` | Coach tool: propose the next training block |
| `src/app/api/block/accept/route.ts` | API: accept a proposed block, create workouts |
| `src/components/chat/block-proposal-card.tsx` | Chat UI: displays proposed block for accept/modify |
| `src/components/calendar/block-banner.tsx` | Calendar UI: "block ends soon" banner |
| `__tests__/lib/training/phase-rules.test.ts` | Tests for phase progression logic |
| `__tests__/lib/training/blocks.test.ts` | Tests for block CRUD utilities |
| `__tests__/app/api/block/accept.test.ts` | Tests for block accept endpoint |
| `__tests__/lib/chat/tools/propose-next-block.test.ts` | Tests for propose_next_block tool structure |
| `supabase/migrations/010_backfill_blocks.sql` | Data backfill: wrap existing plans in blocks |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/training/generate-plan.ts` | `generateTrainingPlan` creates initial block |
| `src/lib/training/schemas.ts` | Add `blockProposalSchema` |
| `src/lib/chat/tools/regenerate-plan.ts` | Scope regeneration to active block |
| `src/lib/chat/tools/index.ts` | Export `proposeNextBlockTool` |
| `src/lib/chat/system-prompt.ts` | Inject block context + proactive trigger |
| `src/app/api/chat/route.ts` | Register `propose_next_block` tool, fetch block data |
| `src/app/dashboard/coach/page.tsx` | Handle `BlockProposalCard` rendering |
| `src/components/calendar/month-view.tsx` | Pass block data to week rows, add banner |
| `src/components/calendar/week-view.tsx` | Show block indicator in sidebar |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/009_training_blocks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 009_training_blocks.sql
-- Training blocks: multi-week periodization units within a plan

create table public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  block_number integer not null,
  block_type text not null check (block_type in (
    'base', 'build', 'peak', 'taper',
    'accumulation', 'intensification', 'deload'
  )),
  block_label text not null,
  week_count integer not null check (week_count between 1 and 6),
  start_date date not null,
  end_date date not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'completed')),
  generation_context jsonb,
  created_at timestamptz not null default now()
);

-- Add block_id FK to planned_workouts (nullable for backward compat)
alter table public.planned_workouts
  add column block_id uuid references public.training_blocks(id) on delete set null;

-- RLS
alter table public.training_blocks enable row level security;

create policy "Users can manage own blocks" on public.training_blocks
  for all using (
    plan_id in (
      select id from public.training_plans
      where user_id = current_setting('app.current_user_id', true)
    )
  );

-- Indexes
create index idx_training_blocks_plan on public.training_blocks(plan_id, block_number);
create index idx_training_blocks_status on public.training_blocks(plan_id, status);
create index idx_planned_workouts_block on public.planned_workouts(block_id);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_training_blocks.sql
git commit -m "feat: add training_blocks table and block_id FK on planned_workouts"
```

---

### Task 2: Phase Progression Rules

**Files:**
- Create: `src/lib/training/phase-rules.ts`
- Test: `__tests__/lib/training/phase-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/training/phase-rules.test.ts
import { describe, it, expect } from "vitest";
import { getNextBlockType, getBlockTypeForRace } from "@/lib/training/phase-rules";

describe("getBlockTypeForRace", () => {
  it("returns base when >12 weeks out", () => {
    expect(getBlockTypeForRace(16)).toBe("base");
  });

  it("returns build when 8-12 weeks out", () => {
    expect(getBlockTypeForRace(10)).toBe("build");
    expect(getBlockTypeForRace(8)).toBe("build");
    expect(getBlockTypeForRace(12)).toBe("build");
  });

  it("returns peak when 3-7 weeks out", () => {
    expect(getBlockTypeForRace(5)).toBe("peak");
    expect(getBlockTypeForRace(3)).toBe("peak");
    expect(getBlockTypeForRace(7)).toBe("peak");
  });

  it("returns taper when 1-2 weeks out", () => {
    expect(getBlockTypeForRace(2)).toBe("taper");
    expect(getBlockTypeForRace(1)).toBe("taper");
  });

  it("returns deload when 0 or negative weeks (race passed)", () => {
    expect(getBlockTypeForRace(0)).toBe("deload");
    expect(getBlockTypeForRace(-1)).toBe("deload");
  });
});

describe("getNextBlockType", () => {
  it("returns race-anchored phase when race date is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 70); // ~10 weeks out
    const raceDate = futureDate.toISOString().slice(0, 10);
    expect(getNextBlockType({ raceDate, currentBlockType: "base", blockNumber: 1 })).toBe("build");
  });

  it("returns deload after race date passes", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    const raceDate = pastDate.toISOString().slice(0, 10);
    expect(getNextBlockType({ raceDate, currentBlockType: "taper", blockNumber: 4 })).toBe("deload");
  });

  it("follows cyclical rotation for non-race users", () => {
    const opts = { raceDate: null, currentBlockType: null, blockNumber: 0 };
    expect(getNextBlockType({ ...opts, currentBlockType: null, blockNumber: 0 })).toBe("accumulation");
    expect(getNextBlockType({ ...opts, currentBlockType: "accumulation", blockNumber: 1 })).toBe("accumulation");
    expect(getNextBlockType({ ...opts, currentBlockType: "accumulation", blockNumber: 2 })).toBe("deload");
    expect(getNextBlockType({ ...opts, currentBlockType: "deload", blockNumber: 3 })).toBe("intensification");
    expect(getNextBlockType({ ...opts, currentBlockType: "intensification", blockNumber: 4 })).toBe("intensification");
    expect(getNextBlockType({ ...opts, currentBlockType: "intensification", blockNumber: 5 })).toBe("deload");
    expect(getNextBlockType({ ...opts, currentBlockType: "deload", blockNumber: 6 })).toBe("accumulation");
  });

  it("starts non-race users with accumulation", () => {
    expect(getNextBlockType({ raceDate: null, currentBlockType: null, blockNumber: 0 })).toBe("accumulation");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/phase-rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement phase rules**

```typescript
// src/lib/training/phase-rules.ts

export type BlockType =
  | "base" | "build" | "peak" | "taper"
  | "accumulation" | "intensification" | "deload";

/** Race-anchored phase from weeks remaining */
export function getBlockTypeForRace(weeksToRace: number): BlockType {
  if (weeksToRace <= 0) return "deload";
  if (weeksToRace <= 2) return "taper";
  if (weeksToRace <= 7) return "peak";
  if (weeksToRace <= 12) return "build";
  return "base";
}

/**
 * Non-race cyclical rotation:
 * accumulation → accumulation → deload → intensification → intensification → deload → repeat
 */
const CYCLE: BlockType[] = [
  "accumulation", "accumulation", "deload",
  "intensification", "intensification", "deload",
];

export function getNextBlockType(opts: {
  raceDate: string | null;
  currentBlockType: BlockType | string | null;
  blockNumber: number;
}): BlockType {
  // Race-anchored: calculate from race date
  if (opts.raceDate) {
    const race = new Date(opts.raceDate);
    const now = new Date();
    const diffMs = race.getTime() - now.getTime();
    const weeksOut = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return getBlockTypeForRace(weeksOut);
  }

  // Non-race: cyclical rotation
  if (!opts.currentBlockType || opts.blockNumber === 0) {
    return "accumulation";
  }

  // Find position in cycle based on block number (1-indexed)
  const cycleIndex = (opts.blockNumber) % CYCLE.length;
  return CYCLE[cycleIndex];
}

/** Human-readable label for a block type */
export function blockTypeLabel(type: BlockType): string {
  const labels: Record<BlockType, string> = {
    base: "Base",
    build: "Build",
    peak: "Peak",
    taper: "Taper",
    accumulation: "Accumulation",
    intensification: "Intensification",
    deload: "Deload",
  };
  return labels[type] || type;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/phase-rules.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/phase-rules.ts __tests__/lib/training/phase-rules.test.ts
git commit -m "feat: add phase progression rules for block-based periodization"
```

---

### Task 3: Block CRUD Utilities

**Files:**
- Create: `src/lib/training/blocks.ts`
- Test: `__tests__/lib/training/blocks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/training/blocks.test.ts
import { describe, it, expect, vi } from "vitest";
import { computeBlockCompliance, computeBlockWeekNumber } from "@/lib/training/blocks";

describe("computeBlockCompliance", () => {
  it("calculates completion percentage from workouts", () => {
    const workouts = [
      { session_type: "Push", status: "completed" },
      { session_type: "Pull", status: "completed" },
      { session_type: "Easy Run", status: "skipped" },
      { session_type: "Rest", status: "scheduled" },
      { session_type: "Legs", status: "completed" },
    ];
    const result = computeBlockCompliance(workouts);
    // 4 non-rest sessions, 3 completed = 75%
    expect(result.total).toBe(4);
    expect(result.completed).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.pct).toBe(75);
  });

  it("returns 0% for empty workouts", () => {
    const result = computeBlockCompliance([]);
    expect(result.pct).toBe(0);
    expect(result.total).toBe(0);
  });

  it("returns 100% when all non-rest sessions completed", () => {
    const workouts = [
      { session_type: "Push", status: "completed" },
      { session_type: "Rest", status: "scheduled" },
    ];
    const result = computeBlockCompliance(workouts);
    expect(result.pct).toBe(100);
  });
});

describe("computeBlockWeekNumber", () => {
  it("returns 1 for a date on the block start_date", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-01")).toBe(1);
  });

  it("returns 2 for a date in the second week", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-09")).toBe(2);
  });

  it("returns the correct week for mid-block dates", () => {
    expect(computeBlockWeekNumber("2026-06-01", "2026-06-20")).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/lib/training/blocks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement block utilities**

```typescript
// src/lib/training/blocks.ts
import { createServerClient } from "@/lib/supabase/server";
import type { BlockType } from "./phase-rules";

export interface TrainingBlock {
  id: string;
  plan_id: string;
  block_number: number;
  block_type: BlockType;
  block_label: string;
  week_count: number;
  start_date: string;
  end_date: string;
  status: "proposed" | "active" | "completed";
  generation_context: Record<string, unknown> | null;
  created_at: string;
}

export interface BlockCompliance {
  total: number;
  completed: number;
  skipped: number;
  pct: number;
}

/** Get the active block for a plan */
export async function getActiveBlock(planId: string): Promise<TrainingBlock | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("plan_id", planId)
    .eq("status", "active")
    .order("block_number", { ascending: false })
    .limit(1)
    .single();
  return data as TrainingBlock | null;
}

/** Get the latest block (any status) for a plan */
export async function getLatestBlock(planId: string): Promise<TrainingBlock | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("plan_id", planId)
    .order("block_number", { ascending: false })
    .limit(1)
    .single();
  return data as TrainingBlock | null;
}

/** Create a new training block */
export async function createBlock(opts: {
  planId: string;
  blockNumber: number;
  blockType: BlockType;
  blockLabel: string;
  weekCount: number;
  startDate: string;
  endDate: string;
  status: "proposed" | "active";
  generationContext?: Record<string, unknown>;
}): Promise<TrainingBlock> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("training_blocks")
    .insert({
      plan_id: opts.planId,
      block_number: opts.blockNumber,
      block_type: opts.blockType,
      block_label: opts.blockLabel,
      week_count: opts.weekCount,
      start_date: opts.startDate,
      end_date: opts.endDate,
      status: opts.status,
      generation_context: opts.generationContext || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Failed to create block: ${error?.message}`);
  return data as TrainingBlock;
}

/** Mark a block as completed */
export async function completeBlock(blockId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("training_blocks")
    .update({ status: "completed" })
    .eq("id", blockId);
}

/** Activate a proposed block */
export async function activateBlock(blockId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("training_blocks")
    .update({ status: "active" })
    .eq("id", blockId);
}

/** Compute compliance stats from workout rows */
export function computeBlockCompliance(
  workouts: Array<{ session_type: string; status: string }>
): BlockCompliance {
  const nonRest = workouts.filter((w) => w.session_type.toLowerCase() !== "rest");
  if (nonRest.length === 0) return { total: 0, completed: 0, skipped: 0, pct: 0 };
  const completed = nonRest.filter((w) => w.status === "completed").length;
  const skipped = nonRest.filter((w) => w.status === "skipped").length;
  return {
    total: nonRest.length,
    completed,
    skipped,
    pct: Math.round((completed / nonRest.length) * 100),
  };
}

/** Compute which week of the block a given date falls in (1-indexed) */
export function computeBlockWeekNumber(blockStartDate: string, currentDate: string): number {
  const start = new Date(blockStartDate);
  const current = new Date(currentDate);
  const diffMs = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

/** Fetch workouts for a block and compute compliance */
export async function getBlockComplianceStats(blockId: string): Promise<BlockCompliance> {
  const supabase = createServerClient();
  const { data: workouts } = await supabase
    .from("planned_workouts")
    .select("session_type, status")
    .eq("block_id", blockId);
  return computeBlockCompliance(workouts || []);
}

/** Fetch recovery trends (avg HRV, avg sleep) over a date range for a user */
export async function getRecoveryTrends(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ avgHrv: number | null; avgSleep: number | null }> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("recovery_logs")
    .select("hrv, sleep_hours")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  const rows = data || [];
  const hrvRows = rows.filter((r) => r.hrv != null);
  const sleepRows = rows.filter((r) => r.sleep_hours != null);

  return {
    avgHrv: hrvRows.length > 0
      ? Math.round(hrvRows.reduce((s, r) => s + r.hrv, 0) / hrvRows.length)
      : null,
    avgSleep: sleepRows.length > 0
      ? Math.round(sleepRows.reduce((s, r) => s + r.sleep_hours, 0) / sleepRows.length * 10) / 10
      : null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/training/blocks.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/training/blocks.ts __tests__/lib/training/blocks.test.ts
git commit -m "feat: add block CRUD utilities and compliance computation"
```

---

### Task 4: Modify Plan Generation to Create Initial Block

**Files:**
- Modify: `src/lib/training/generate-plan.ts` (lines 119-187, the `generateTrainingPlan` function)

- [ ] **Step 1: Add block creation to `generateTrainingPlan`**

Read `src/lib/training/generate-plan.ts`. Add imports at the top:

```typescript
import { getNextBlockType, blockTypeLabel } from "./phase-rules";
import { createBlock } from "./blocks";
```

Then modify `generateTrainingPlan` (after the plan is inserted into `training_plans` and workouts are generated). After the existing `generatePlannedWorkouts` call and before the workouts insert, add block creation logic.

Find the section that looks like:

```typescript
  // Generate 4 weeks starting next Monday
  const nextMonday = getNextMonday();
  const workouts = generatePlannedWorkouts(newPlan.id, plan.weekly_layout, nextMonday, 4);

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workouts);
```

Replace with:

```typescript
  // Determine initial block type from phase rules
  const blockType = getNextBlockType({
    raceDate: input.goals.race_date,
    currentBlockType: null,
    blockNumber: 0,
  });

  const weekCount = plan.plan_config?.deload_frequency || 4;
  const nextMonday = getNextMonday();
  const endDate = new Date(nextMonday);
  endDate.setDate(endDate.getDate() + weekCount * 7 - 1);

  // Create the initial block
  const block = await createBlock({
    planId: newPlan.id,
    blockNumber: 1,
    blockType,
    blockLabel: `${blockTypeLabel(blockType)} Block`,
    weekCount,
    startDate: nextMonday.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    status: "active",
    generationContext: {
      source: "onboarding",
      raceDate: input.goals.race_date,
    },
  });

  // Generate workouts for the block duration
  const workouts = generatePlannedWorkouts(newPlan.id, plan.weekly_layout, nextMonday, weekCount);

  // Set block_id on all workouts
  const workoutsWithBlock = workouts.map((w) => ({ ...w, block_id: block.id }));

  const { error: workoutsError } = await supabase
    .from("planned_workouts")
    .insert(workoutsWithBlock);
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run __tests__/lib/training/`
Expected: All existing training tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/training/generate-plan.ts
git commit -m "feat: create initial training block during plan generation"
```

---

### Task 5: Block Accept Endpoint

**Files:**
- Create: `src/app/api/block/accept/route.ts`
- Test: `__tests__/app/api/block/accept.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/api/block/accept.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

const mockUpdate = vi.fn(() => Promise.resolve({ error: null }));
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockSingle = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "training_blocks") {
        return {
          update: vi.fn(() => ({ eq: mockUpdate })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    single: mockSingle,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "planned_workouts") {
        return { insert: mockInsert };
      }
      return {};
    }),
  })),
}));

beforeEach(() => {
  mockUpdate.mockReset().mockReturnValue(Promise.resolve({ error: null }));
  mockInsert.mockReset().mockReturnValue(Promise.resolve({ error: null }));
  mockSingle.mockReset();
});

describe("POST /api/block/accept", () => {
  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: null });
    const { POST } = await import("@/app/api/block/accept/route");
    const res = await POST(new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ block_id: "b1" }),
    }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/app/api/block/accept.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the accept endpoint**

```typescript
// src/app/api/block/accept/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { expandBlocksToWorkouts } from "@/lib/training/generate-plan";
import type { WeekBlock } from "@/lib/training/schemas";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { block_id, raw_blocks } = body;

  if (!block_id) {
    return NextResponse.json({ error: "block_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch the proposed block
  const { data: block, error: blockErr } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("id", block_id)
    .single();

  if (blockErr || !block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  if (block.status !== "proposed") {
    return NextResponse.json({ error: "Block is not in proposed status" }, { status: 400 });
  }

  // Complete the previous active block for this plan
  await supabase
    .from("training_blocks")
    .update({ status: "completed" })
    .eq("plan_id", block.plan_id)
    .eq("status", "active");

  // Activate the proposed block
  await supabase
    .from("training_blocks")
    .update({ status: "active" })
    .eq("id", block_id);

  // Create planned workouts from raw_blocks if provided
  if (raw_blocks && Array.isArray(raw_blocks) && raw_blocks.length > 0) {
    const startDate = new Date(block.start_date);
    const workouts = expandBlocksToWorkouts(block.plan_id, raw_blocks as WeekBlock[], startDate);
    const workoutsWithBlock = workouts.map((w) => ({ ...w, block_id }));

    const { error: insertErr } = await supabase
      .from("planned_workouts")
      .insert(workoutsWithBlock);

    if (insertErr) {
      return NextResponse.json({ error: "Failed to create workouts" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, block_id });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/app/api/block/accept.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/block/accept/route.ts __tests__/app/api/block/accept.test.ts
git commit -m "feat: add /api/block/accept endpoint"
```

---

### Task 6: `propose_next_block` Coach Tool

**Files:**
- Create: `src/lib/chat/tools/propose-next-block.ts`
- Test: `__tests__/lib/chat/tools/propose-next-block.test.ts`
- Modify: `src/lib/chat/tools/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/chat/tools/propose-next-block.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe("proposeNextBlockTool", () => {
  it("exports a tool function", async () => {
    const { proposeNextBlockTool } = await import("@/lib/chat/tools/propose-next-block");
    const tool = proposeNextBlockTool("user-123");
    expect(tool).toBeDefined();
    expect(tool.description).toContain("block");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/chat/tools/propose-next-block.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Update `multiWeekPlanSchema` max weeks**

In `src/lib/training/schemas.ts`, find the `multiWeekPlanSchema` definition (line 76-82). Change `.max(4)` to `.max(6)`:

```typescript
  weeks: z.array(weekBlockSchema).min(1).max(6),
```

- [ ] **Step 4: Implement the tool**

Read `src/lib/chat/tools/regenerate-plan.ts` for the existing pattern. Then create:

```typescript
// src/lib/chat/tools/propose-next-block.ts
import { tool } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { generateMultiWeekPlan } from "@/lib/training/generate-plan";
import { getNextBlockType, blockTypeLabel } from "@/lib/training/phase-rules";
import { getActiveBlock, getBlockComplianceStats, getRecoveryTrends, createBlock } from "@/lib/training/blocks";
import { formatComplianceForPrompt } from "@/lib/training/compliance";

export function proposeNextBlockTool(userId: string) {
  return tool({
    description: "Propose the next training block when the current block is nearing its end. Generates a structured multi-week plan based on phase progression, compliance, and recovery.",
    parameters: z.object({
      user_request: z.string().optional().describe("Optional user-specific request for the next block, e.g. 'more running' or 'make it a deload'"),
    }),
    execute: async ({ user_request }) => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      // Fetch user profile and goals
      const [profileRes, goalsRes, planRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_goals").select("*").eq("user_id", userId).single(),
        supabase.from("training_plans").select("*").eq("user_id", userId).eq("status", "active").single(),
      ]);

      const profile = profileRes.data;
      const goals = goalsRes.data;
      const plan = planRes.data;

      if (!plan) {
        return { success: false, error: "No active training plan found." };
      }

      // Get current active block
      const activeBlock = await getActiveBlock(plan.id);

      // Determine next block type
      const currentBlockType = activeBlock?.block_type || null;
      const currentBlockNumber = activeBlock?.block_number || 0;
      const nextBlockType = getNextBlockType({
        raceDate: goals?.race_date || null,
        currentBlockType,
        blockNumber: currentBlockNumber,
      });

      // Get compliance from active block
      let complianceText: string | null = null;
      if (activeBlock) {
        const compliance = await getBlockComplianceStats(activeBlock.id);
        const recoveryTrends = await getRecoveryTrends(
          userId,
          activeBlock.start_date,
          activeBlock.end_date,
        );
        complianceText = [
          `Previous block: ${activeBlock.block_label} (${activeBlock.week_count} weeks)`,
          `Compliance: ${compliance.pct}% (${compliance.completed}/${compliance.total} sessions)`,
          compliance.skipped > 0 ? `Skipped: ${compliance.skipped} sessions` : null,
          recoveryTrends.avgHrv ? `Avg HRV during block: ${recoveryTrends.avgHrv}` : null,
          recoveryTrends.avgSleep ? `Avg sleep during block: ${recoveryTrends.avgSleep}h` : null,
        ].filter(Boolean).join("\n");
      }

      // Determine week count (LLM will decide, but suggest based on block type)
      const suggestedWeeks = nextBlockType === "deload" ? 1
        : nextBlockType === "taper" ? 2
        : 4;

      // Generate the multi-week plan
      const multiWeekPlan = await generateMultiWeekPlan({
        userId,
        profile: {
          age: profile?.age || null,
          height: profile?.height || null,
          weight: profile?.weight || null,
          sex: profile?.sex || null,
          training_experience: profile?.training_experience || null,
        },
        goals: {
          body_goal: goals?.body_goal || "general",
          emphasis: goals?.emphasis || null,
          days_per_week: goals?.days_per_week || 4,
          lifting_days: goals?.lifting_days || null,
          training_for_race: goals?.training_for_race || false,
          race_type: goals?.race_type || null,
          race_date: goals?.race_date || null,
          goal_time: goals?.goal_time || null,
          does_cardio: goals?.does_cardio || false,
          cardio_types: goals?.cardio_types || [],
        },
        weeks: suggestedWeeks,
        compliance: complianceText,
        userRequest: user_request
          ? `${user_request}. Recommended phase: ${blockTypeLabel(nextBlockType)}`
          : `Generate a ${blockTypeLabel(nextBlockType)} block.`,
      });

      // Calculate start/end dates
      const nextMonday = getNextMonday();
      const actualWeeks = multiWeekPlan.weeks.length;
      const endDate = new Date(nextMonday);
      endDate.setDate(endDate.getDate() + actualWeeks * 7 - 1);

      // Create the proposed block
      const newBlock = await createBlock({
        planId: plan.id,
        blockNumber: currentBlockNumber + 1,
        blockType: nextBlockType,
        blockLabel: `${blockTypeLabel(nextBlockType)} — ${multiWeekPlan.narrative.slice(0, 60)}`,
        weekCount: actualWeeks,
        startDate: nextMonday.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        status: "proposed",
        generationContext: {
          phaseRule: nextBlockType,
          compliance: complianceText,
          userRequest: user_request || null,
        },
      });

      // Format week layouts for display
      const weekLayouts = multiWeekPlan.weeks.map((week) => ({
        week_number: week.week_number,
        week_focus: week.week_focus,
        days: week.days.map((d) => ({
          day_label: d.day_label,
          am_session: d.am_session,
          pm_session: d.pm_session,
          is_rest: d.is_rest,
        })),
      }));

      return {
        success: true,
        block_id: newBlock.id,
        block_type: nextBlockType,
        block_label: newBlock.block_label,
        block_number: newBlock.block_number,
        week_count: actualWeeks,
        start_date: newBlock.start_date,
        end_date: newBlock.end_date,
        narrative: multiWeekPlan.narrative,
        risks: multiWeekPlan.risks,
        week_layouts: weekLayouts,
        raw_blocks: multiWeekPlan.weeks,
      };
    },
  });
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
```

- [ ] **Step 5: Export the new tool**

Read `src/lib/chat/tools/index.ts`. Add the new export:

```typescript
export { proposeNextBlockTool } from "./propose-next-block";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run __tests__/lib/chat/tools/propose-next-block.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/chat/tools/propose-next-block.ts src/lib/chat/tools/index.ts src/lib/training/schemas.ts __tests__/lib/chat/tools/propose-next-block.test.ts
git commit -m "feat: add propose_next_block coach tool, extend schema to 6 weeks"
```

---

### Task 7: Scope `regenerate_plan` to Active Block

**Files:**
- Modify: `src/lib/chat/tools/regenerate-plan.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/chat/tools/regenerate-plan.ts` fully. Note the compliance query section (~lines 47-93) and the `generateMultiWeekPlan` call (~lines 95-119).

- [ ] **Step 2: Add import and fetch active block**

Add import at top of the file:

```typescript
import { getActiveBlock } from "@/lib/training/blocks";
```

Inside the `execute` function, after the line that fetches the active plan (`const plan = ...`), add:

```typescript
      const activeBlock = await getActiveBlock(plan.id);
```

- [ ] **Step 3: Scope the compliance query to block date range**

Find the section that queries `planned_workouts` for compliance (the query with `.eq("plan_id", plan.id)`). Add date range filters when a block exists. After the existing `.eq("plan_id", plan.id)` line, add:

```typescript
      // Scope to active block date range
      if (activeBlock) {
        query = query.gte("date", activeBlock.start_date).lte("date", activeBlock.end_date);
      }
```

If the query is chained (not stored in a variable), refactor it to store in a variable first so you can conditionally add filters.

- [ ] **Step 4: Set weeks from block and include block_id in return**

Find the `generateMultiWeekPlan` call. Change the `weeks` parameter:

```typescript
      weeks: activeBlock?.week_count ?? 2,
```

In the return object at the end of the execute function, add `block_id`:

```typescript
      return {
        success: true,
        // ... existing fields ...
        block_id: activeBlock?.id ?? null,
      };
```

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run __tests__/lib/chat/tools/`
Expected: All tool tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/tools/regenerate-plan.ts
git commit -m "feat: scope regenerate_plan tool to active block"
```

---

### Task 8: System Prompt Block Context

**Files:**
- Modify: `src/lib/chat/system-prompt.ts`

- [ ] **Step 1: Read the current file**

Read `src/lib/chat/system-prompt.ts` fully. Note the `BuildSystemPromptInput` interface and `buildSystemPrompt` function.

- [ ] **Step 2: Add block fields to the input interface**

Find the input interface/type for `buildSystemPrompt`. Add:

```typescript
  block?: {
    block_type: string;
    block_label: string;
    block_number: number;
    week_count: number;
    current_week: number;
    end_date: string;
    days_until_end: number;
    compliance_pct: number | null;
  } | null;
```

- [ ] **Step 3: Inject block context into the prompt**

Inside `buildSystemPrompt`, after the existing plan section (around line 134), add:

```typescript
  // Block context
  if (block) {
    lines.push("");
    lines.push(`Current block: ${block.block_label} (Block ${block.block_number}) — Week ${block.current_week} of ${block.week_count}`);
    lines.push(`Block ends: ${block.end_date}${block.days_until_end <= 3 ? ` (${block.days_until_end} days)` : ""}`);
    if (block.compliance_pct !== null) {
      lines.push(`Block compliance: ${block.compliance_pct}%`);
    }

    if (block.days_until_end <= 3) {
      lines.push("");
      lines.push("IMPORTANT: The athlete's current block ends in " + block.days_until_end + " days. Proactively suggest proposing the next block. Use the propose_next_block tool when the user agrees.");
    }
  }
```

- [ ] **Step 4: Update the tool instruction line**

Find the existing line about `regenerate_plan` (around line 170). Update it to also mention `propose_next_block`:

```typescript
  lines.push("- When the user wants to restructure their current block, use regenerate_plan.");
  lines.push("- When the user's block is ending or they want to move to the next phase, use propose_next_block.");
```

- [ ] **Step 5: Run existing system-prompt tests**

Run: `npx vitest run __tests__/lib/chat/system-prompt.test.ts`
Expected: PASS (may need to update test to include the new optional `block` field).

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat/system-prompt.ts
git commit -m "feat: inject block context into coach system prompt"
```

---

### Task 9: Register Tool and Fetch Block Data in Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Read the current file**

Read `src/app/api/chat/route.ts` fully.

- [ ] **Step 2: Add imports**

Add at top:

```typescript
import { proposeNextBlockTool } from "@/lib/chat/tools";
import { getActiveBlock, getBlockComplianceStats, computeBlockWeekNumber } from "@/lib/training/blocks";
```

- [ ] **Step 3: Fetch block data alongside existing queries**

In the parallel data fetch section (around lines 55-71), add block fetching after the plan is loaded. After the existing `Promise.all` resolves and we have `plan`, add:

```typescript
  // Fetch active block if plan exists
  let blockContext = null;
  if (plan) {
    const activeBlock = await getActiveBlock(plan.id);
    if (activeBlock) {
      const compliance = await getBlockComplianceStats(activeBlock.id);
      const today = new Date().toISOString().slice(0, 10);
      const endDate = new Date(activeBlock.end_date);
      const daysUntilEnd = Math.ceil((endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      blockContext = {
        block_type: activeBlock.block_type,
        block_label: activeBlock.block_label,
        block_number: activeBlock.block_number,
        week_count: activeBlock.week_count,
        current_week: computeBlockWeekNumber(activeBlock.start_date, today),
        end_date: activeBlock.end_date,
        days_until_end: Math.max(0, daysUntilEnd),
        compliance_pct: compliance.pct,
      };
    }
  }
```

- [ ] **Step 4: Pass block context to system prompt**

In the `buildSystemPrompt` call (around line 119), add `block: blockContext`:

```typescript
  const systemPrompt = buildSystemPrompt({
    // ... existing fields ...
    block: blockContext,
  });
```

- [ ] **Step 5: Register the new tool**

In the `tools` object inside `streamText` (around line 194-202), add:

```typescript
      propose_next_block: proposeNextBlockTool(userId),
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: register propose_next_block tool and inject block context"
```

---

### Task 10: BlockProposalCard Component

**Files:**
- Create: `src/components/chat/block-proposal-card.tsx`

- [ ] **Step 1: Read the existing PlanProposalCard**

Read `src/components/chat/plan-proposal-card.tsx` for the existing pattern, styling, and accept flow.

- [ ] **Step 2: Create BlockProposalCard**

Create `src/components/chat/block-proposal-card.tsx`. This is similar to `PlanProposalCard` but:
- Shows block type label and week count in the header
- Calls `/api/block/accept` instead of `/api/plan/accept`
- Passes `block_id` and `raw_blocks` to the accept endpoint

```typescript
// src/components/chat/block-proposal-card.tsx
"use client";

import { useState } from "react";
import { blockTypeLabel } from "@/lib/training/phase-rules";

interface BlockProposalData {
  success: boolean;
  block_id: string;
  block_type: string;
  block_label: string;
  block_number: number;
  week_count: number;
  start_date: string;
  end_date: string;
  narrative: string;
  risks: string[];
  week_layouts: Array<{
    week_number: number;
    week_focus: string;
    days: Array<{
      day_label: string;
      am_session: string | null;
      pm_session: string | null;
      is_rest: boolean;
    }>;
  }>;
  raw_blocks: unknown[];
}

const SESSION_COLORS: Record<string, string> = {
  push: "#ef4444",
  pull: "#3b82f6",
  legs: "#22c55e",
  upper: "#8b5cf6",
  lower: "#f59e0b",
  run: "#06b6d4",
  ride: "#f97316",
  swim: "#0ea5e9",
  rest: "#d1d5db",
};

function getSessionColor(session: string | null): string {
  if (!session) return SESSION_COLORS.rest;
  const lower = session.toLowerCase();
  for (const [key, color] of Object.entries(SESSION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#6b7280";
}

export function BlockProposalCard({ data }: { data: BlockProposalData }) {
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch("/api/block/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: data.block_id,
          raw_blocks: data.raw_blocks,
        }),
      });
      if (res.ok) setAccepted(true);
    } finally {
      setAccepting(false);
    }
  };

  if (accepted) {
    return (
      <div style={{
        padding: 16, borderRadius: 12, background: "#f0fdf4",
        border: "1px solid #bbf7d0", fontSize: 13, color: "#15803d",
      }}>
        {data.block_label} accepted and scheduled.
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 12, border: "1px solid #e5e7eb",
      background: "#fff", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {blockTypeLabel(data.block_type as Parameters<typeof blockTypeLabel>[0])} Block
          <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
            {data.week_count} week{data.week_count !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          {data.narrative}
        </div>
      </div>

      {/* Week layouts */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {data.week_layouts.map((week) => (
          <div key={week.week_number}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Week {week.week_number}: {week.week_focus}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {week.days.map((day) => {
                const session = day.am_session || day.pm_session;
                const hasTwoSessions = day.am_session && day.pm_session;
                return (
                  <div key={day.day_label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 3 }}>
                      {day.day_label}
                    </div>
                    <div style={{
                      height: hasTwoSessions ? 32 : 20,
                      borderRadius: 4,
                      background: day.is_rest ? "#f3f4f6" : getSessionColor(session),
                      opacity: day.is_rest ? 0.5 : 0.8,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                    }}>
                      {hasTwoSessions && (
                        <div style={{
                          height: "50%", borderRadius: "4px 4px 0 0",
                          background: getSessionColor(day.am_session),
                          opacity: 0.9,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 9, color: "#6b7280", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {day.is_rest ? "Rest" : (session || "").split("—")[0].trim().slice(0, 12)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Risks */}
      {data.risks.length > 0 && (
        <div style={{ padding: "0 16px 12px", fontSize: 11, color: "#92400e" }}>
          {data.risks.map((risk, i) => (
            <div key={i} style={{ marginBottom: 2 }}>&#9888; {risk}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #e5e7eb",
        display: "flex", gap: 8,
      }}>
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="btn-coral"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          {accepting ? "Accepting..." : "Accept Block"}
        </button>
        <button
          onClick={() => {
            // Focus the chat input for modifications
            const input = document.querySelector<HTMLInputElement>("input[type=text]");
            input?.focus();
          }}
          style={{
            padding: "8px 16px", fontSize: 13, borderRadius: 8,
            border: "1px solid #e5e7eb", background: "#fff",
            color: "#374151", cursor: "pointer",
          }}
        >
          Make changes
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/block-proposal-card.tsx
git commit -m "feat: add BlockProposalCard component"
```

---

### Task 11: Handle Block Proposals in Coach Page

**Files:**
- Modify: `src/app/dashboard/coach/page.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/dashboard/coach/page.tsx`.

- [ ] **Step 2: Add BlockProposalCard import and extraction**

Add import:

```typescript
import { BlockProposalCard } from "@/components/chat/block-proposal-card";
```

Add a new extraction function alongside the existing `extractPlanProposal`:

```typescript
function extractBlockProposal(parts: unknown[]): unknown | null {
  for (const part of parts) {
    const p = part as Record<string, unknown>;

    if (p.type === "tool-result" && p.toolName === "propose_next_block" && p.result) {
      return p.result;
    }

    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as Record<string, unknown> | undefined;
      if (inv?.toolName === "propose_next_block") {
        if (inv.state === "result" && inv.result) return inv.result;
        if (inv.output) return inv.output;
      }
    }

    if (p.type === "tool-propose_next_block") {
      if (p.state === "output-available" && p.output) return p.output;
      if (p.state === "result" && p.result) return p.result;
    }

    if ((p as Record<string, unknown>).toolName === "propose_next_block") {
      if (p.output) return p.output;
      if (p.result) return p.result;
    }
  }
  return null;
}
```

- [ ] **Step 3: Render BlockProposalCard in the message loop**

In the messages render loop, after `extractPlanProposal`, add:

```typescript
              const blockData = m.role === "assistant" ? extractBlockProposal(parts) : null;
```

Then, after the existing `PlanProposalCard` rendering block, add:

```typescript
                  {blockData && (blockData as Record<string, unknown>).success && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 32, flexShrink: 0 }} />
                      <div style={{ maxWidth: 560, width: "100%" }}>
                        <BlockProposalCard data={blockData as Parameters<typeof BlockProposalCard>[0]["data"]} />
                      </div>
                    </div>
                  )}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/coach/page.tsx
git commit -m "feat: render BlockProposalCard in coach chat"
```

---

### Task 12: Calendar Week Sidebar Block Indicator

**Files:**
- Modify: `src/components/calendar/month-view.tsx` or `src/components/calendar/week-view.tsx` (whichever renders the week sidebar)

- [ ] **Step 1: Read calendar components**

Read these files to understand how week data flows:
- `src/components/calendar/month-view.tsx`
- `src/components/calendar/week-view.tsx`
- `src/app/dashboard/page.tsx`

Identify where the week sidebar stats (time, load, distance, fitness/fatigue/form) are rendered.

- [ ] **Step 2: Add block data to the dashboard data fetch**

Read `src/app/dashboard/page.tsx` (or the data fetching logic). Add a query to fetch the active block for the user's plan. Pass the block data down to the calendar views.

In the data fetch, add:

```typescript
// Fetch active block
let activeBlock = null;
if (plan) {
  const { data: block } = await supabase
    .from("training_blocks")
    .select("*")
    .eq("plan_id", plan.id)
    .eq("status", "active")
    .single();
  activeBlock = block;
}
```

Pass `activeBlock` as a prop to the calendar component.

- [ ] **Step 3: Render block indicator in week sidebar**

In the week sidebar section, add at the top (before existing stats):

```typescript
{activeBlock && weekStartDate >= activeBlock.start_date && weekEndDate <= activeBlock.end_date && (
  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 8 }}>
    {blockTypeLabel(activeBlock.block_type)} · Wk {computeBlockWeekNumber(activeBlock.start_date, weekStartDate)}/{activeBlock.week_count}
  </div>
)}
```

Import `blockTypeLabel` from `@/lib/training/phase-rules` and `computeBlockWeekNumber` from `@/lib/training/blocks`.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/ src/app/dashboard/
git commit -m "feat: show block indicator in calendar week sidebar"
```

---

### Task 13: Calendar Block-Ending Banner

**Files:**
- Create: `src/components/calendar/block-banner.tsx`
- Modify: `src/components/calendar/month-view.tsx` (or the parent that wraps the calendar grid)

- [ ] **Step 1: Create the banner component**

```typescript
// src/components/calendar/block-banner.tsx
"use client";

import Link from "next/link";
import { blockTypeLabel } from "@/lib/training/phase-rules";
import type { BlockType } from "@/lib/training/phase-rules";

interface BlockBannerProps {
  blockType: string;
  endDate: string;
  daysUntilEnd: number;
}

export function BlockBanner({ blockType, endDate, daysUntilEnd }: BlockBannerProps) {
  if (daysUntilEnd > 3 || daysUntilEnd < 0) return null;

  const endDay = new Date(endDate).toLocaleDateString("en-US", { weekday: "long" });
  const label = blockTypeLabel(blockType as BlockType);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 16px", marginBottom: 12,
      background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
      fontSize: 13, color: "#92400e",
    }}>
      <span>
        Your <strong>{label}</strong> block ends {endDay}
      </span>
      <Link
        href="/dashboard/coach"
        style={{
          color: "#d97706", fontWeight: 600, textDecoration: "none",
          fontSize: 12,
        }}
      >
        Ask Coach &rarr;
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Add the banner to the calendar page**

In the calendar page (the component that wraps `MonthView`/`WeekView`), render the `BlockBanner` above the calendar grid when there's an active block ending soon:

```typescript
import { BlockBanner } from "@/components/calendar/block-banner";

// Inside the render, above the calendar grid:
{activeBlock && daysUntilBlockEnd <= 3 && (
  <BlockBanner
    blockType={activeBlock.block_type}
    endDate={activeBlock.end_date}
    daysUntilEnd={daysUntilBlockEnd}
  />
)}
```

Compute `daysUntilBlockEnd`:

```typescript
const daysUntilBlockEnd = activeBlock
  ? Math.ceil((new Date(activeBlock.end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  : 999;
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/block-banner.tsx src/components/calendar/ src/app/dashboard/
git commit -m "feat: add block-ending banner to calendar page"
```

---

### Task 14: Data Backfill Migration

**Files:**
- Create: `supabase/migrations/010_backfill_blocks.sql`

- [ ] **Step 1: Write the backfill migration**

```sql
-- 010_backfill_blocks.sql
-- Backfill: wrap existing active plans in a training block

INSERT INTO public.training_blocks (plan_id, block_number, block_type, block_label, week_count, start_date, end_date, status, generation_context)
SELECT
  tp.id AS plan_id,
  1 AS block_number,
  COALESCE(
    (tp.plan_config->>'periodization_phase'),
    'accumulation'
  ) AS block_type,
  COALESCE(
    INITCAP(tp.plan_config->>'periodization_phase') || ' Block',
    'Accumulation Block'
  ) AS block_label,
  GREATEST(1, CEIL(
    (MAX(pw.date) - MIN(pw.date) + 1)::numeric / 7
  ))::integer AS week_count,
  MIN(pw.date) AS start_date,
  MAX(pw.date) AS end_date,
  'active' AS status,
  jsonb_build_object('source', 'backfill') AS generation_context
FROM public.training_plans tp
JOIN public.planned_workouts pw ON pw.plan_id = tp.id
WHERE tp.status = 'active'
GROUP BY tp.id;

-- Set block_id on existing planned_workouts
UPDATE public.planned_workouts pw
SET block_id = tb.id
FROM public.training_blocks tb
WHERE tb.plan_id = pw.plan_id
  AND tb.status = 'active'
  AND tb.generation_context->>'source' = 'backfill'
  AND pw.block_id IS NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: Migration applied, existing plans wrapped in blocks.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_backfill_blocks.sql
git commit -m "feat: backfill existing plans with training blocks"
```

---

## Dependency Graph

```
Task 1 (DB migration)
  ├── Task 2 (phase rules) — no DB dependency, pure function
  ├── Task 3 (block CRUD) — depends on Task 1 schema
  │   ├── Task 4 (initial block in generateTrainingPlan) — depends on 2, 3
  │   ├── Task 5 (block accept endpoint) — depends on 3
  │   ├── Task 6 (propose_next_block tool) — depends on 2, 3, 5
  │   ├── Task 7 (scope regenerate_plan) — depends on 3
  │   └── Task 12 (sidebar indicator) — depends on 3
  ├── Task 8 (system prompt) — depends on 3
  ├── Task 9 (register tool in chat route) — depends on 6, 8
  ├── Task 10 (BlockProposalCard) — depends on 5
  ├── Task 11 (coach page rendering) — depends on 10
  ├── Task 13 (block banner) — depends on 2
  └── Task 14 (data backfill) — depends on 1, run after all code ships
```

**Parallelizable groups:**
- Tasks 2 + 3 can run in parallel after Task 1
- Tasks 4 + 5 + 7 + 8 can run in parallel after Tasks 2 + 3
- Tasks 10 + 12 + 13 can run in parallel (UI components)
- Task 14 runs last
