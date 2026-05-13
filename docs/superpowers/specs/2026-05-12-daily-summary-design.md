# Daily Summary — AI-Generated Daily Briefing

## Overview

A persistent card at the top of the dashboard that shows a single AI-generated paragraph (4-5 sentences) summarizing today's recovery status and completed activities. Generated once per day via Claude, cached in Supabase, and automatically re-generated when new activity or recovery data syncs in.

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
3. Compute `data_hash` from the fetched data
4. Check `daily_summaries` for existing row matching `(user_id, date)`
   - If exists and `data_hash` matches: return cached `summary`, `cached: true`
   - If exists but `data_hash` differs: regenerate, upsert, return `cached: false`
   - If no row: generate, insert, return `cached: false`
5. Generation: call Claude with structured prompt containing today's metrics

### Prompt Design

**System prompt:**
```
You are a concise sports coach writing a daily briefing for a serious athlete.
Write exactly one paragraph of 4-5 flowing sentences. Cover: recovery status
(sleep, HRV, resting HR), training completed today, and one actionable
observation or recommendation. Reference specific numbers. Be direct and
encouraging, not generic. No markdown, no bullet points, no headers.
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

ACTIVITIES:
1. Easy Run — 8.1 km, 45:30, avg HR 138, pace 5:37/km, 412 kcal
2. Upper Body Lift — 52 min, 6 exercises

No activities logged: false
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
