# Phase 7: Dashboard & Polish — Design Spec

## Goal

Wire the dashboard home page with real data from Supabase — today's planned session, this week's training strip, quick stats (calories with progress bar, weight with direction, recovery as gauge), quick action buttons, and sync status. Polish any remaining UI gaps.

## Architecture

The dashboard page becomes a client component that fetches data from a new `/api/dashboard` route. This route aggregates data from multiple tables in a single request: today's planned workout, this week's workouts + completions (reuses the plan API pattern), today's nutrition, today's recovery, and current weight. Components are small and focused.

## Dashboard Layout

**Top: Today Card**
- Today's session type (e.g., "Push Day", "Easy Run (Zone 2)", "Rest Day")
- AI note if present ("HRV 52, sleep 7.8h — push hard today")
- Recovery snapshot: HRV, sleep, body battery as small badges
- Quick action buttons: "Chat with Coach" (links to /dashboard/chat with pre-fill), "View Plan" (links to /dashboard/plan)

**Middle: This Week**
- Reuses the `WeekStrip` component from Phase 4
- Shows planned sessions with completion status from Hevy/Strava

**Bottom: Quick Stats (3 cards)**
1. **Calories** — Today's calories as a progress bar toward a target (target = avg of last 7 days if no explicit target, or 2000 as fallback). Shows "1,800 / 2,400 cal".
2. **Weight** — Current weight + direction arrow (up/down/stable based on last 7 days trend). Shows "182 lbs ↓".
3. **Recovery** — Simple gauge showing overall readiness based on HRV + sleep + body battery. Shows "Good" / "Fair" / "Low" with color.

**Existing: Sync Status**
- Already exists as `SyncStatus` component — keep it.

## API Route: `GET /api/dashboard`

Returns all data needed for the dashboard in one request:

```typescript
{
  today: {
    date: string,
    session_type: string | null,
    ai_notes: string | null,
  },
  weekWorkouts: PlannedWorkout[],
  weekCompletions: Record<string, Completion>,
  weekStart: string,
  nutrition: {
    calories: number,
    protein: number,
    target_calories: number, // 7-day avg or 2000 fallback
  } | null,
  recovery: {
    hrv: number | null,
    sleep_hours: number | null,
    body_battery: number | null,
    readiness: "good" | "fair" | "low",
  } | null,
  weight: {
    current: number | null, // lbs
    direction: "up" | "down" | "stable",
  } | null,
}
```

## Readiness Calculation

Simple scoring based on available data:
- HRV >= 50 OR body_battery >= 60 OR sleep >= 7h → "good"
- HRV >= 35 OR body_battery >= 40 OR sleep >= 6h → "fair"
- Otherwise → "low"

If no recovery data, return null (don't show the card).

## What This Phase Does NOT Include

- Sparkline charts (future enhancement)
- Notification system
- Profile editing in Settings (already has integration management)
- Landing page changes (already built)
