# Block-Based Periodization Design

## Overview

Introduce training blocks as a first-class concept in Trainer. A block is a multi-week training chunk (2-6 weeks) with a specific focus (base, build, peak, taper, accumulation, intensification, deload). Blocks provide structured periodization that auto-adapts based on the user's race calendar, compliance, and recovery trends.

The system uses a unified model: race users get date-anchored phases calculated from their race date, non-race users get cyclical mesocycles. Same DB schema, different labeling logic.

## Data Model

### New table: `training_blocks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `plan_id` | uuid FK → training_plans | |
| `block_number` | integer | Sequential within the plan (1, 2, 3...) |
| `block_type` | text | `base`, `build`, `peak`, `taper`, `accumulation`, `intensification`, `deload` |
| `block_label` | text | Human-readable, LLM-generated (e.g., "Build — Increase Run Volume") |
| `week_count` | integer | How many weeks this block spans (1-6) |
| `start_date` | date | First Monday of the block |
| `end_date` | date | Last Sunday of the block |
| `status` | text | `proposed`, `active`, `completed` |
| `generation_context` | jsonb | Snapshot of inputs: compliance %, HRV trend, sleep trend, phase rule |
| `created_at` | timestamptz | |

Status constraint: `check (status in ('proposed', 'active', 'completed'))`.

Block type constraint: `check (block_type in ('base', 'build', 'peak', 'taper', 'accumulation', 'intensification', 'deload'))`.

### Modified table: `planned_workouts`

Add one column:
- `block_id` uuid FK → training_blocks (nullable, for backward compatibility)

## Phase Progression Rules

Phase determination is a pure function (not stored procedure), called when proposing the next block.

### Race users

Calculated from `user_goals.race_date`:

| Weeks to race | Phase |
|---------------|-------|
| >12 | `base` |
| 8-12 | `build` |
| 3-7 | `peak` |
| 1-2 | `taper` |

### Non-race users

Cyclical rotation:

```
accumulation → accumulation → deload → intensification → intensification → deload → repeat
```

The LLM can override this rotation based on recovery signals (e.g., extend a deload if HRV is tanking, skip straight to intensification if compliance and recovery are both high).

### Post-race transition

When a race user's `race_date` has passed, phase rules switch to the non-race cyclical rotation starting with a `deload` block (recovery after race). Subsequent blocks follow the accumulation/intensification/deload cycle until the user sets a new race date.

### Block length

Decided by the LLM (2-6 weeks) based on context:
- Race proximity may dictate shorter blocks (2-week taper)
- Base phases for beginners may be longer (5-6 weeks)
- Deload blocks are typically 1-2 weeks
- Default heuristic in the prompt: 3-4 weeks for standard blocks

## Block Lifecycle

### 1. Initial block (onboarding)

When `generateTrainingPlan` creates the first plan, it also creates the first `training_blocks` row. Block type determined by phase rules:
- Race users: calculate from race date
- Non-race users: start with `accumulation`

Status set to `active`. Workouts created with `block_id` set.

### 2. Block nearing end

When the active block's `end_date` is within 3 days, two things happen:

**Coach page**: The system prompt gets an injection telling the coach to proactively suggest the next block. On the user's first message, the coach mentions the block is ending and offers to propose the next one.

**Calendar page**: A thin banner appears above the calendar grid:
```
Your Build block ends Sunday — Ask Coach →
```
Links to `/dashboard/coach`. Disappears once a new block is accepted or the block date has passed.

### 3. Proposal generation

The `propose_next_block` coach tool:
1. Reads the active block → gets `block_number`, `block_type`, `end_date`
2. Runs phase rules → determines recommended next `block_type`
3. Fetches compliance from active block's workouts (completed / skipped / total)
4. Fetches recovery trends (avg HRV, avg sleep over the block's date range)
5. Calls `generateMultiWeekPlan` with all context
6. Creates a `training_blocks` row with status `proposed`
7. Returns the proposal for display as a `BlockProposalCard` in chat

### 4. Acceptance

User reviews the proposal in chat and clicks Accept:
- Proposed block status → `active`
- Previous block status → `completed`
- `planned_workouts` rows created with `block_id` set
- Endpoint: `/api/block/accept` (similar to existing `/api/plan/accept`)

### 5. No response

If the user doesn't accept before the block ends:
- Calendar shows no planned workouts for future dates
- The banner persists on the calendar page
- No auto-generation

## Coach Integration

### New tool: `propose_next_block`

Input schema:
- `user_request` (optional string) — specific asks like "I want more running" or "make it a deload"

Internally runs the proposal generation flow described above.

### Modified tool: `regenerate_plan`

Becomes "regenerate current block":
- Only regenerates workouts within the active block's date range
- Keeps the same block record (same `block_type`, `block_number`)
- Replaces existing workouts for that block
- Use case: "I don't like this week's schedule, redo it"

### System prompt additions

The coach's system prompt gets current block context:

```
Current block: Build (Block 2 of plan) — Week 3 of 4
Block ends: 2026-06-08 (3 days)
Block compliance: 85% (11/13 sessions completed)
```

When the block ends within 3 days, append:

```
IMPORTANT: The athlete's current block ends in X days.
Proactively suggest proposing the next block if the conversation
topic is relevant, or if this is the user's first message of the session.
```

### Generation context for `propose_next_block`

The LLM receives:
- Phase rule recommendation (what the rules say the next phase should be)
- Compliance stats from the ending block (% completed, which session types were skipped)
- Recovery trends over the block (avg HRV, avg sleep, trend direction)
- User profile and goals (same as today)
- Recent activity stats (same as today)
- Optional `user_request` override

This is stored in `generation_context` on the block record as a snapshot.

## Calendar UI Changes

### Week sidebar

Add a block indicator at the top of the existing week sidebar:

```
Build · Wk 2/4
```

- Format: `{block_type_label} · Wk {current_week_in_block}/{total_weeks}`
- Styling: small muted text, same style as existing week stat labels
- Only shows for weeks that belong to a block

### Block-ending banner

Thin banner above the calendar grid when active block ends within 3 days:

```
Your Build block ends Sunday — Ask Coach →
```

- Light background, small text, inline link to `/dashboard/coach`
- Disappears once a new block is accepted or the block end date passes

### No changes to

- Day cells, workout cards, cardio cards
- Chart modals, detail modals
- Overall calendar layout

## Migration Strategy

### Schema migration (`009_training_blocks.sql`)

1. Create `training_blocks` table
2. Add `block_id` nullable FK column to `planned_workouts`

### Data backfill

For each active `training_plan`:
1. Query min/max dates from its `planned_workouts`
2. Create one `training_blocks` row:
   - `block_type`: from `plan_config.periodization_phase` if set, else `accumulation`
   - `block_label`: derive from block_type (e.g., "Accumulation Block")
   - `week_count`: derived from date range
   - `start_date` / `end_date`: from workout date range
   - `block_number`: 1
   - `status`: `active`
3. Update all `planned_workouts` for that plan to set `block_id`

## Out of Scope

- **No block history page** — past blocks visible through calendar, no dedicated UI
- **No manual phase override in settings** — users tell the coach via chat
- **No auto-generation** — if user ignores proposal, calendar goes empty
- **No block-level analytics** — no "your build block improved VO2 max by X"
- **No changes to onboarding flow** — existing data is sufficient
