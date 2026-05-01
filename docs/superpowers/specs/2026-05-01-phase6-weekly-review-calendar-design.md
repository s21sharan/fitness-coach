# Phase 6: Weekly Review & Google Calendar — Design Spec

## Goal

Build a dedicated Weekly Review page that displays AI-generated weekly summaries with historical check-in data, and add full Google Calendar integration — OAuth connect, read availability for scheduling, write planned sessions as calendar events, and detect reschedules.

## Architecture

Two independent features sharing the plan data layer:

1. **Weekly Review Page** — `/dashboard/review` displays the current week's AI summary from `weekly_check_ins`, stat cards (compliance, nutrition, recovery), risk flags, and a scrollable history of past check-ins. Read-only — approve/reject stays on the Plan page.

2. **Google Calendar Integration** — OAuth 2.0 connect flow, bidirectional sync. Reads user's calendar for availability when generating/adjusting plans, writes approved sessions as calendar events, detects user reschedules on the Sunday night cron.

## Database

### Existing Tables Used

**`weekly_check_ins`** (Phase 4) — Source for the review page:
- `ai_summary`, `compliance_pct`, `avg_calories`, `avg_protein`, `avg_sleep_hours`, `avg_hrv`
- `adjustments`, `risk_flags`, `next_week_layout`
- `user_approved`, `week_start_date`

**`integrations`** (Phase 1) — Already supports `google_calendar` provider:
- `access_token`, `refresh_token`, `credentials` (stores `expires_at`)

**`planned_workouts`** (Phase 1) — Already has `calendar_event_id` field

### New Migration: `004_planned_workouts_time.sql`

Add time-of-day scheduling to planned workouts:

```sql
ALTER TABLE public.planned_workouts
  ADD COLUMN scheduled_time timestamptz;
```

This allows planned sessions to have a specific time (e.g., "Push Day at 6:00 AM Monday") rather than just a date. Nullable — sessions without Google Calendar still work with date-only.

## Weekly Review Page

### Page: `/dashboard/review`

**This Week's Review (top section):**

Shows the most recent `weekly_check_ins` row:

- **AI Summary** — Full text from `ai_summary`, displayed as a card with Coach's purple avatar
- **Stat Cards** — Row of 5 cards:
  - Compliance: `compliance_pct`% with color (green >80%, amber 50-80%, red <50%)
  - Avg Calories: `avg_calories` cal
  - Avg Protein: `avg_protein`g
  - Avg Sleep: `avg_sleep_hours`h
  - Avg HRV: `avg_hrv`
- **Risk Flags** — Red alert cards if `risk_flags` array is non-empty
- **Adjustments** — List of proposed changes with type badges (volume, frequency, etc.)
- Empty state: "Your first weekly review will appear after your first full week of training."

**Historical Check-ins (bottom section):**

Scrollable list of all past `weekly_check_ins`, newest first:

- Each row shows: week date range (e.g., "Apr 21 – Apr 27"), compliance %, truncated summary (first ~100 chars)
- Click to expand: full AI summary, all stat values, adjustments, risk flags
- Accordion-style — one expanded at a time

### API Route: `GET /api/review`

Returns current + historical check-ins for the user:

```typescript
{
  current: WeeklyCheckIn | null,  // Most recent check-in
  history: WeeklyCheckIn[],       // Past check-ins, newest first, limit 12
}
```

## Google Calendar Integration

### OAuth Flow

Follows the same pattern as Strava OAuth (Phase 3):

**`GET /api/integrations/google-calendar/authorize`**
- Redirects to Google OAuth consent screen
- Scopes: `https://www.googleapis.com/auth/calendar.events` (read + write events)
- State parameter carries `userId` through the flow

**`GET /api/integrations/google-calendar/callback`**
- Exchanges authorization code for tokens
- Stores in `integrations` table: `provider: "google_calendar"`, `access_token`, `refresh_token`, `credentials: { expires_at }`
- Redirects to `/dashboard/settings?google_calendar=success`

**Token refresh:** Google tokens expire after 1 hour. Use a token manager (same pattern as Strava's `StravaTokenManager`) that checks expiry and refreshes before API calls.

### Settings UI

Add Google Calendar to the Settings page integrations list:
- Same `IntegrationCard` component used for other providers
- Connection type: OAuth (same as Strava — click Connect, redirects to Google)
- Shows "Connected" / "Not connected" status

### Reading Calendar (Availability)

When generating or adjusting a plan, if the user has Google Calendar connected:

1. Fetch events from the user's primary calendar for the target week
2. Parse busy times into time slots
3. Identify available windows (default training hours: 5 AM - 9 PM, configurable later)
4. Include availability in the Claude prompt: "Available slots: Mon 6-8am, Mon 5-7pm, Tue 6-8am..."
5. Claude assigns `scheduled_time` to each session based on availability

**Google Calendar API call:**
```
GET https://www.googleapis.com/calendar/v3/calendars/primary/events
  ?timeMin=2026-05-04T00:00:00Z
  &timeMax=2026-05-10T23:59:59Z
  &singleEvents=true
  &orderBy=startTime
```

### Writing Events

When a plan is approved (initial generation or weekly adjustment):

1. For each non-rest `planned_workouts` row with a `scheduled_time`:
   - Create a Google Calendar event
   - Title: `"[Hybro] {session_type}"` (e.g., "[Hybro] Push Day")
   - Description: `"AI-suggested session. Log your workout in Hevy/Strava."`
   - Duration: 75 minutes (default)
   - Store returned `calendar_event_id` in `planned_workouts`

2. If updating an existing plan (weekly adjustment approved):
   - Delete old calendar events for the affected week
   - Create new events for the updated sessions

**Calendar write happens in:**
- The `generateTrainingPlan` function (after initial plan creation)
- The check-in approval POST handler (after user approves adjustments)

### Reschedule Detection

On the Sunday night cron (already exists in `server/src/sync/scheduler.ts`):

1. For users with Google Calendar connected and an active plan:
2. Fetch calendar events for the past week that match `[Hybro]` prefix
3. Compare each event's start time to the `scheduled_time` in `planned_workouts`
4. If a user moved an event in Google Calendar, update the `planned_workouts.scheduled_time` to match
5. Include reschedule info in the weekly check-in data sent to Claude

### Google Calendar Client

New file in the server: `server/src/integrations/google-calendar-client.ts`

Handles:
- Token refresh (Google tokens expire hourly)
- `getEvents(startDate, endDate)` — fetch events for a date range
- `createEvent(summary, description, startTime, durationMinutes)` — create a calendar event
- `deleteEvent(eventId)` — remove a calendar event
- `getAvailableSlots(startDate, endDate)` — parse events into busy/available windows

Also a Next.js-side utility at `src/lib/google-calendar.ts` for the plan generation flow.

## Integration Points

### Plan Generation (Phase 4 modification)

When generating a plan via `generateTrainingPlan`:
1. Check if user has Google Calendar connected
2. If yes, fetch availability for the next 4 weeks
3. Include availability in the Claude prompt
4. Claude's structured output includes `scheduled_time` per session (not just `session_type`)
5. After plan is saved, create calendar events for approved sessions

The `planGenerationSchema` gets an optional `scheduled_time` field added to each day layout entry.

### Weekly Adjustment (Phase 4 modification)

When the Sunday cron runs `runWeeklyCheckIn`:
1. Before gathering data, check for reschedules (Google Calendar moves)
2. Include reschedule info in the adjustment prompt
3. After storing check-in, if user has Google Calendar, include availability in the proposed next_week_layout
4. When user approves adjustments, create/update calendar events

### Chat Coach (Phase 5 modification)

Add a new tool to the chat agent:
- `get_calendar` — reads upcoming Google Calendar events so Coach can suggest scheduling

## Tech Stack

- **Google API:** `googleapis` npm package for Calendar API
- **Frontend:** React components, Tailwind (follows existing patterns)
- **Backend:** Express cron additions for reschedule detection
- **Auth:** Google OAuth 2.0 with PKCE

## What This Phase Does NOT Include

- Trend charts/graphs (Phase 7 polish)
- Configurable training time preferences (uses default 5 AM - 9 PM window)
- Multiple calendar support (primary calendar only)
- Push notifications for plan changes
