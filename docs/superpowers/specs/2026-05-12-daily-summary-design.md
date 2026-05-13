# Daily Summary — AI-Generated Daily Briefing

## Overview

A persistent card at the top of the dashboard that shows an AI-generated paragraph (5-6 sentences) summarizing today's recovery status, completed activities, and one specific, actionable training recommendation. Generated once per day via Claude, cached in Supabase, and automatically re-generated when new activity or recovery data syncs in.

## Placement

Top of the dashboard page, above the charts section. Acts as a "good morning" greeting card — the first thing the user sees.

## Data Inputs

The summary is built from two categories of data for **today only**:

### Recovery Metrics (from `recovery_logs`)
- Sleep hours + sleep score
- HRV
- Resting HR
- Body battery
- Stress level
- Steps

### Activity Metrics (from `workout_logs` + `cardio_logs`)
- Each completed workout: name, duration, exercise count
- Each cardio session: type, distance, duration, avg HR, pace, calories, elevation

### Recent Training History (from `workout_logs`, last 14 days)

Used to generate the specific training recommendation line. The API computes:

- **Per-muscle-group volume** over the last 14 days using `computeMuscleVolume()` from `src/lib/exercise-muscles.ts` — total sets and volume (kg x reps) for each of the 11 muscle groups (chest, back, shoulders, biceps, triceps, quads, hamstrings, glutes, calves, core, forearms)
- **Exercise history**: every exercise performed in the last 14 days with its best set (heaviest weight x reps), total sets, and most recent RPE
- **Weight progression**: for exercises performed more than once, whether the user went up, stayed flat, or dropped weight between sessions
- **Planned workout for today** (from `planned_workouts`): what the user is supposed to train today, so the recommendation aligns with the upcoming session

This data is passed to Claude as a structured block so it can identify:
- Muscle groups with low or zero volume in the last 14 days (e.g., "You haven't hit rear delts in 12 days — add face pulls to your push day")
- Exercises where the user has been at the same weight for 3+ sessions (e.g., "You've benched 185x6 three sessions in a row — try 190 for 4-5 reps today")
- Rep range imbalances — all sets in the 8-12 range with no heavy work, or vice versa (e.g., "Your squat work has all been 3x10 lately — throw in a heavy triple to keep strength up")
- Complementary exercise suggestions for muscles being trained today (e.g., if today is pull day: "Your brachialis hasn't been targeted directly — add hammer curls or cross-body curls")

If no recovery or activity data exists for today, the summary reflects that (e.g., "No activities logged yet today. Recovery data shows...").

## Database

New table: `daily_summaries`

```sql
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

- `data_hash`: MD5 or simple hash of the JSON-serialized recovery + activity data. Used to detect when underlying data has changed (e.g., a Strava sync adds a new run after the summary was first generated).
- One row per user per day. Upsert on regeneration.

## API Route

`POST /api/daily-summary`

### Request
```json
{ "date": "2026-05-12" }
```

`date` is optional, defaults to today. Allows fetching summaries for past days if needed later.

### Response
```json
{
  "summary": "Your HRV is at 52ms this morning, up from your 7-day average of 48 — a sign your body is adapting well to the recent training block...",
  "generated_at": "2026-05-12T08:30:00Z",
  "cached": true
}
```

### Logic

1. Authenticate via Clerk
2. Fetch today's data from `recovery_logs`, `workout_logs`, `cardio_logs`
3. Fetch last 14 days of `workout_logs` (with exercises) for training history analysis
4. Fetch today's `planned_workouts` for context on what's scheduled
5. Compute muscle volume per group using `computeMuscleVolume()` from `src/lib/exercise-muscles.ts`
6. Build exercise history: for each exercise across the 14-day window, compute best set, frequency, weight progression trend, and last RPE
7. Compute `data_hash` from all fetched data (today's metrics + recent history)
8. Check `daily_summaries` for existing row matching `(user_id, date)`
   - If exists and `data_hash` matches: return cached `summary`, `cached: true`
   - If exists but `data_hash` differs: regenerate, upsert, return `cached: false`
   - If no row: generate, insert, return `cached: false`
9. Generation: call Claude with structured prompt containing today's metrics + training history

### Prompt Design

**System prompt:**
```
You are a concise sports coach writing a daily briefing for a serious athlete.
Write exactly one paragraph of 5-6 flowing sentences. Cover:
1. Recovery status (sleep, HRV, resting HR)
2. Training completed today (if any)
3. One specific, actionable training recommendation based on the recent
   workout history data provided

The training recommendation MUST be concrete and specific — name a specific
exercise, rep range, or weight target. Examples of good recommendations:
- "Your rear delts haven't been hit in 12 days — add 3x15 face pulls today."
- "You've been pressing 185 for 6 reps three sessions running — push for 190x4 today."
- "All your squat work has been 3x10 — throw in a heavy set of 3 to maintain strength."
- "Your brachialis is undertrained — swap one curl variation for hammer curls."

Do NOT give generic advice like "listen to your body" or "stay hydrated."
Reference specific numbers from the data. Be direct and encouraging.
No markdown, no bullet points, no headers.
```

**User prompt:** structured data payload:
```
Today: 2026-05-12

RECOVERY:
- Sleep: 7.2h (score: 82)
- HRV: 52ms (7-day avg: 48)
- Resting HR: 54 bpm
- Body Battery: 71
- Stress: 28
- Steps: 4,200

ACTIVITIES TODAY:
1. Easy Run — 8.1 km, 45:30, avg HR 138, pace 5:37/km, 412 kcal
2. Upper Body Lift — 52 min, 6 exercises

PLANNED TODAY: Pull day (from training plan)

MUSCLE VOLUME (last 14 days, sets):
- chest: 18 sets, 14400 kg volume
- back: 22 sets, 18700 kg volume
- shoulders: 12 sets, 5400 kg volume
- biceps: 8 sets, 2800 kg volume
- triceps: 10 sets, 3200 kg volume
- quads: 16 sets, 22000 kg volume
- hamstrings: 6 sets, 8400 kg volume
- glutes: 8 sets, 12000 kg volume
- calves: 0 sets
- core: 4 sets
- forearms: 0 sets

EXERCISE HISTORY (last 14 days):
- Bench Press: best 185lb x 6, last RPE 8, performed 3 sessions (same weight all 3)
- Barbell Row: best 155lb x 8, last RPE 7, performed 2 sessions (went up 10lb)
- Lat Pulldown: best 140lb x 10, last RPE 7, performed 2 sessions
- Hammer Curl: best 35lb x 10, last RPE 6, performed 1 session
- Face Pull: not performed in 14 days
- Calf Raise: not performed in 14 days
```

Uses `@anthropic-ai/sdk` directly (consistent with existing `/api/insights` route).

## UI Component

### `DailySummaryCard`

Location: `src/components/dashboard/daily-summary-card.tsx`

**Behavior:**
- Fetches from `/api/daily-summary` on mount
- Shows a skeleton loader while generating (first load of the day may take 2-3 seconds)
- Displays the summary paragraph once loaded
- No refresh button — re-generates automatically when data changes (next page load after a sync will detect the hash mismatch)

**Layout:**
- Full-width card at the top of the dashboard, above charts
- Left side: greeting text ("Today" + formatted date like "Monday, May 12")
- Below greeting: the summary paragraph in normal-weight text
- Subtle background (e.g., light gray or very faint blue), rounded corners, minimal styling
- No icons, no sections, no dividers — just clean text

**States:**
- **Loading**: skeleton text placeholder (2-3 lines of gray shimmer)
- **Loaded**: greeting + summary paragraph
- **No data**: if no recovery AND no activities, show a simple "No data synced for today yet" message instead of calling the AI
- **Error**: silently fall back to no card (don't show errors for a non-critical feature)

## Edge Cases

- **No data at all for today**: skip the AI call, show "No data synced for today yet" in muted text
- **Only recovery, no activities**: generate summary focused on recovery readiness ("You're well-rested with an HRV of 52 — a good day for a quality session")
- **Only activities, no recovery**: generate summary focused on training completed
- **Multiple syncs throughout the day**: each page load checks the hash, regenerates if data changed. At most a few regenerations per day.
- **No workout history (new user)**: skip the training recommendation portion, focus on recovery and general readiness
- **Today's plan is a rest day**: recommendation can still suggest mobility work or note that the rest is well-timed given recent volume
- **Past days**: the API supports a `date` param but the UI only shows today. Future extensibility if we want historical summaries.

## Files to Create/Modify

1. **New migration**: `supabase/migrations/005_daily_summaries.sql` — create table
2. **New API route**: `src/app/api/daily-summary/route.ts` — fetch data, cache logic, Claude call
3. **New component**: `src/components/dashboard/daily-summary-card.tsx` — UI card
4. **Modify**: `src/app/dashboard/page.tsx` — render `DailySummaryCard` at top of page

## Non-Goals

- No conversation or follow-up — this is a static one-paragraph summary, not a chat
- No historical summary browsing (for now)
- No notifications or push — only visible when the user opens the dashboard
- No weekly/monthly rollup — daily only
