# Phase 4: Training Plan Engine — Design Spec

## Goal

Replace the hardcoded split recommendation with an AI-powered training plan engine. Claude generates personalized training splits with weekly layouts, handles hybrid athletes and race periodization, and auto-adjusts plans weekly based on synced data from MacroFactor, Hevy, Strava, and Garmin.

## Architecture

Three components:

1. **Plan Generation** — Next.js server action calls Claude API (Vercel AI SDK) with structured output to generate a split + weekly layout after onboarding or on demand.
2. **Weekly View UI** — `/dashboard/plan` page showing a 7-day strip with session types, completion status (matched to Hevy/Strava data), AI notes, and Garmin recovery context.
3. **Weekly Auto-Adjustment** — Sunday night cron job on the Railway Express backend gathers 7 days of data, sends to Claude, stores proposed adjustments, and surfaces them for user approval.

## Database

### Existing Tables (from Phase 1 migration)

**`training_plans`** — The user's active training split:
- `id`, `user_id`
- `split_type` — enum: full_body, upper_lower, ppl, arnold, phul, bro_split, hybrid_upper_lower, hybrid_nick_bare
- `body_goal`, `race_type` (nullable)
- `status` — enum: active, paused, completed
- `plan_config` — JSONB (periodization settings, split details, race info)
- `last_adjusted_at`, `created_at`

**`planned_workouts`** — Individual days in the plan:
- `id`, `plan_id` (FK → training_plans)
- `date`, `day_of_week`
- `session_type` — string: "Push", "Upper Body", "Easy Run (Zone 2)", "Long Ride + Brick Run", "Rest", etc.
- `ai_notes` — text (optional: "HRV 52, sleep 7.8h — push hard today")
- `status` — enum: scheduled, completed, skipped, moved
- `approved` — boolean
- `synced_at`

### New Migration: `003_weekly_check_ins.sql`

**`weekly_check_ins`** — Weekly auto-adjustment records:
- `id` uuid PK
- `user_id` text FK → users
- `plan_id` uuid FK → training_plans
- `week_start_date` date
- `compliance_pct` integer (0-100)
- `avg_calories` integer
- `avg_protein` integer
- `avg_sleep_hours` numeric
- `avg_hrv` integer
- `weight_trend` jsonb (start, end, direction)
- `training_volume` jsonb (sessions planned vs completed, by type)
- `ai_summary` text (Claude's analysis)
- `adjustments` jsonb (array of adjustment objects)
- `risk_flags` jsonb (array of strings)
- `next_week_layout` jsonb (proposed 7-day plan)
- `user_approved` boolean (null = pending, true = approved, false = rejected)
- `created_at` timestamptz

RLS: users can view/manage own check-ins.

## Plan Generation

### Trigger

- After onboarding completion (replaces hardcoded `recommendSplit()`)
- On demand from Settings ("Regenerate Plan")
- After user edits profile/goals that affect the plan

### Claude Prompt

**System prompt:**
```
You are a certified personal trainer and endurance coach creating a training plan.
Generate a structured training split based on the user's profile, goals, and constraints.
Your plan should be split-level (session types like "Push", "Upper Body", "Easy Run Zone 2"),
NOT exercise-level. Users choose their own exercises in their tracking apps.

For hybrid/race athletes, use proper periodization:
- Base phase: high volume, low intensity
- Build phase: increasing intensity, sport-specific work
- Peak phase: race-specific sessions, reduced volume
- Taper phase: significant volume reduction, maintain intensity
```

**User context included:**
- Profile: age, height, weight, experience level
- Body goal: muscle gain, fat loss, maintain, race training
- Emphasis: shoulders, chest, back, arms, legs, balanced
- Available days per week + specific day preferences
- Race info: type, date, goal time (if applicable)
- Current date (for race periodization calculations)

**Structured output schema:**
```typescript
{
  split_type: "ppl" | "arnold" | "upper_lower" | "full_body" | "phul" | "bro_split" | "hybrid_upper_lower" | "hybrid_nick_bare",
  reasoning: string,
  weekly_layout: [
    {
      day_of_week: number,       // 0=Monday, 6=Sunday
      session_type: string,      // "Push", "Rest", "Upper Body + Easy Run (Zone 2)", etc.
      ai_notes: string | null,
    }
  ],
  plan_config: {
    periodization_phase?: "base" | "build" | "peak" | "taper",
    race_weeks_out?: number,
    deload_frequency?: number,
    notes?: string,
  }
}
```

### Server Action Flow

1. Load user profile + goals from Supabase
2. Call Claude via Vercel AI SDK with structured output (`generateObject`)
3. Deactivate any existing active plan (`status: 'completed'`)
4. Insert new `training_plans` row
5. Generate `planned_workouts` for next 4 weeks based on `weekly_layout`
6. Return plan to UI

### Onboarding Integration

The onboarding split result step (`step-split-result.tsx`) gets rewritten:
- Shows a loading state ("Generating your personalized plan...")
- Calls the plan generation server action
- Displays Claude's recommended split with reasoning
- Shows the weekly layout preview
- User taps "Looks good" to finalize onboarding

## Weekly View UI

### Page: `/dashboard/plan`

**Header:**
- Plan name ("Push / Pull / Legs" or "Upper/Lower + Race Prep")
- Goal context ("Muscle Gain · Week 3 of 12" or "Half Ironman · Build Phase · Race in 12 weeks")
- Week navigation: ← Prev | This Week | Next →

**Week strip:** 7 day cards in a grid, each showing:

| State | Styling | Content |
|-------|---------|---------|
| Completed (lifting) | Green border, ✓ | Session type + duration + exercise count (from Hevy) |
| Completed (cardio) | Green border, ✓ | Session type + distance + pace + avg HR (from Strava) |
| Completed (multi-session) | Green border, ✓✓ | Both data sources shown |
| Today (scheduled) | Blue border + glow | Session type + AI note using Garmin recovery data |
| Future (scheduled) | Gray border | Session type + AI note if present |
| Rest | Gray border, — | "Rest" / "Recovery day" |
| Missed (past, no data) | Red-tinted | Session type + "Missed" badge |

**Color coding:**
- 🟢 Green — Lifting sessions (Hevy data)
- 🔵 Blue — Running (Strava data)
- 🟣 Indigo — Swimming (Strava data)
- 🟡 Amber — Key sessions (tempo runs, long rides, brick workouts)

**Completion matching logic:**
- Match `planned_workouts` to synced data by date + session type category
- Lifting sessions (Push, Pull, Legs, Upper, Lower, etc.) → match to `workout_logs` on same date
- Cardio sessions (Run, Ride, Swim) → match to `cardio_logs` on same date by type
- Multi-session days check both sources

**Pending adjustments banner** (below week strip):
- Appears when `weekly_check_ins` has a row with `user_approved = null`
- Shows Claude's summary + adjustment descriptions
- "Review Changes" button opens detail view
- "Approve" applies the new plan, "Reject" keeps current

### Adjustment Review

When user taps "Review Changes", show:
- Side-by-side: current week layout vs proposed next week
- Each adjustment listed with reason ("Reduce volume 15% — HRV trending down")
- Risk flags highlighted in red
- Approve / Reject / "Let me ask my coach" (opens chat with context)

## Weekly Auto-Adjustment

### Cron Schedule

Runs Sunday at 9 PM UTC on the Railway Express backend. (MVP uses UTC; user-timezone-aware scheduling is a future enhancement.)

### Data Gathering

For the current user's last 7 days, query:
- `workout_logs` — completed lifting sessions, exercises, volume
- `cardio_logs` — completed cardio, distance, pace, HR
- `nutrition_logs` — daily calories, protein, carbs, fat
- `recovery_logs` — HRV, resting HR, sleep hours/score, body battery, stress
- `planned_workouts` — what was scheduled vs what was completed/skipped
- `training_plans` — current plan config, periodization phase
- `user_profiles` + `user_goals` — goals, race info, emphasis

### Claude Prompt

**System prompt:**
```
You are a fitness coach analyzing a client's past week and adjusting their plan.
Review their compliance, recovery, nutrition, and performance data.
Propose adjustments for next week. Be specific about what to change and why.
Do not make changes unless the data supports it.
```

**Structured output:**
```typescript
{
  summary: string,
  compliance_pct: number,
  adjustments: [
    {
      type: "volume" | "frequency" | "intensity" | "session_swap" | "rest_day" | "periodization",
      description: string,
      affected_days: number[],
    }
  ],
  risk_flags: string[],
  next_week_layout: [
    {
      day_of_week: number,
      session_type: string,
      ai_notes: string | null,
    }
  ],
}
```

### Processing

1. Store result in `weekly_check_ins` table
2. Generate `planned_workouts` for next week with `approved: false`
3. User sees banner on Plan page → approves or rejects
4. On approve: update `planned_workouts` to `approved: true`
5. On reject: delete proposed workouts, keep current plan rolling

### Adjustment Examples

- Missed 2 of 4 sessions → reduce frequency, keep intensity
- HRV trending down + poor sleep → insert extra rest day, reduce volume 20%
- Hit all sessions + weight trending toward goal → progress as planned
- 4 weeks from race → begin taper, reduce lifting volume, sharpen cardio
- User emphasized shoulders but hasn't done lateral raises → suggest Arnold split swap

## Tech Stack

- **AI:** Claude API via Vercel AI SDK (`generateObject` for structured output)
- **Frontend:** React components with Tailwind, client-side fetching for plan data
- **Backend:** Railway Express cron job for weekly adjustments
- **Database:** Supabase (existing tables + new weekly_check_ins)

## Dependencies

- Phase 3 integrations (synced data in Supabase) — **done**
- Vercel AI SDK + Anthropic provider — **needs npm install**
- `@ai-sdk/anthropic` package

## What This Phase Does NOT Include

- Exercise-level prescriptions (users pick exercises in Hevy)
- Google Calendar integration (Phase 6)
- AI Chat Coach (Phase 5)
- Real-time adjustment (weekly cadence only)
