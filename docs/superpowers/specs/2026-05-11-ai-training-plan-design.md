# AI Training Plan — Design Spec

**Date:** 2026-05-11  
**Status:** Approved  
**Approach:** Calendar-First (Approach A)

## Overview

Add AI-generated training plans that appear on the calendar as greyed-out future workouts with full detail (type, distance, pace, HR targets, coaching notes). The AI coach generates and adjusts plans via the Coach page chat. Plans roll forward automatically — every Sunday night, the coach analyzes the completed week and generates the next week, always keeping 2 weeks planned ahead.

### Core Principles

- **Calendar = review.** The calendar shows planned workouts (future) and actual activity (past). No plan editing on the calendar itself.
- **Coach = interact.** All plan generation, adjustments, and approvals happen through the Coach page conversation.
- **No silent changes.** Auto-generated weeks require approval. User-requested changes via chat take effect immediately.
- **Data-driven targets.** Cardio pace/distance targets come from the user's recent Strava data, not manual input.

## 1. Calendar Display

### Planned Workouts (Future Days)

Render as cards with reduced opacity (0.5) and a dashed left border (instead of solid). Each card shows:

- Activity icon + session type (e.g., "Easy Run Zone 2", "Push")
- **Cardio:** target distance, target pace, target duration, target HR zone
- **Lifting:** muscle focus ("Chest/Shoulders/Triceps"), estimated duration
- AI coaching note in smaller text ("Keep HR under 145, nasal breathing")
- A small "Planned" tag in the corner

### Past Days — Compliance Badges

Past days keep the existing colored activity cards from synced data. A small compliance badge appears in the top-right of each day column:

| Badge | Meaning |
|---|---|
| Green dot | Actual activity matched the planned session type |
| Orange dot | Activity happened but different type than planned |
| Red dot | Planned session with no matching activity (missed) |
| No dot | Rest day or no plan for that day |

### Compliance Matching Logic

Matching is keyword-based on `planned_workouts.session_type`:

| Planned session_type contains | Matches if on that date... |
|---|---|
| "Run", "Jog", "Zone 2 Run", "Tempo Run", "Long Run" | Any `cardio_logs` entry with `type = 'run'` |
| "Bike", "Ride", "Cycling" | Any `cardio_logs` entry with `type = 'bike'` |
| "Swim", "Pool" | Any `cardio_logs` entry with `type = 'swim'` |
| "Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Arms", "Shoulders", "Back", "Chest" | Any `workout_logs` entry (from Hevy) |
| "Rest", "Recovery", "Off" | No activity = compliant. Activity present = bonus (still green) |

A planned "Easy Run (Zone 2)" matches any Strava run that day. Simple keyword matching avoids false negatives.

## 2. Plan Generation & AI Targets

### Enhanced Plan Generation

The existing AI plan generation (Claude via Vercel AI SDK) gets augmented with the user's recent activity data in the prompt:

- Last 30 days of Strava cardio: avg pace by type, avg distance, avg HR per zone
- Last 30 days of Hevy workouts: frequency, avg duration
- Current recovery state: recent HRV trend, sleep avg

### Extended Workout Schema

The AI outputs an extended schema per workout:

```json
{
  "session_type": "Easy Run (Zone 2)",
  "ai_notes": "Keep HR under 145, focus on nasal breathing",
  "target_distance_km": 8.0,
  "target_duration_min": 48,
  "target_pace_min_km": 5.8,
  "target_hr_zone": 2,
  "target_hr_max": 145,
  "muscle_focus": null
}
```

For lifting:

```json
{
  "session_type": "Push",
  "ai_notes": "Progressive overload — aim to add 2.5kg to bench from last week",
  "target_distance_km": null,
  "target_duration_min": 55,
  "target_pace_min_km": null,
  "target_hr_zone": null,
  "target_hr_max": null,
  "muscle_focus": "Chest/Shoulders/Triceps"
}
```

### Storage

New nullable JSONB column on `planned_workouts`:

```sql
ALTER TABLE planned_workouts ADD COLUMN targets jsonb;
```

Targets stored as JSONB avoids changing the existing column structure. The `session_type` and `ai_notes` columns remain as-is for backward compatibility.

## 3. Rolling 2-Week Regeneration

### Sunday Night Trigger

A cron job (Next.js cron route at `/api/plan/regenerate`) runs every Sunday. For each user with an active plan:

**Step 1 — Analyze the completed week:**
- Pull workout_logs, cardio_logs, recovery_logs for the past 7 days
- Compare against planned_workouts to compute compliance, volume delta, recovery trends

**Step 2 — Shift the window:**
- The existing "next week" (week 1) stays unchanged unless recovery flags something
- Generate a new "week 2" that covers days 8-14 from now

**Step 3 — Call Claude with context:**
- Current plan split type and config
- What was planned vs. what actually happened this past week
- Recovery data (HRV trend, sleep, body battery)
- The existing upcoming week (so it doesn't conflict)
- User's goals and race date if applicable

**Step 4 — Insert new planned_workouts** for the new week 2, with `approved: false`.

**Step 5 — Post a coach message:**
> "I've planned your week of May 19-25. Here's what I'm thinking: [summary]. You had a heavy week so I pulled back volume 10%. Review and approve when ready."

### Safety Rules

- **No silent changes to approved workouts.** The cron only generates new weeks and flags concerns.
- If the coach detects a problem with the existing upcoming week (HRV crash, 3 missed days), it proposes modifications as "suggested edits" in the coach chat — not auto-applied.
- All modifications require approval through the Coach page.

## 4. Coach Page Integration

### Auto-Suggestions (from the cron)

- The regeneration cron posts a structured message to the coach conversation (`chat_messages` table with `type: "plan_suggestion"`)
- User sees the message on the Coach page with a summary of planned sessions
- Below the message: **Approve** and **Edit** buttons
- **Approve:** marks all `planned_workouts` for that week as `approved: true`, they render solid on the calendar
- **Edit:** opens follow-up chat where user can say "Move the long run to Saturday" — coach regenerates and presents revised plan

### Manual Requests (user-initiated)

User types requests like:
- "Can you add a swim on Wednesday?"
- "I want to focus more on zone 2 this month"
- "Regenerate my plan, I'm feeling overtrained"

The coach has tool access to:
- `read_plan` — current plan and upcoming workouts
- `read_activity` — recent workout/cardio/recovery logs
- `read_recovery` — HRV, sleep, body battery trends
- `update_plan` — modify existing planned_workouts
- `create_workouts` — add new planned_workouts
- `delete_workouts` — remove planned_workouts

After making changes, the coach posts a summary with a compact weekly grid:

```
Mon: Push · Chest/Shoulders · 55min
Tue: Easy Run · 8km · Z2 · 48min  
Wed: Pull · Back/Biceps · 50min
Thu: Rest
Fri: Tempo Run · 6km · Z3-Z4 · 35min
Sat: Legs · Quads/Glutes · 60min
Sun: Long Run · 14km · Z2 · 1h25m
```

User-requested changes take effect immediately on the calendar (no separate approval needed).

## 5. Data Flow & Architecture

### New Migration

```sql
ALTER TABLE planned_workouts ADD COLUMN targets jsonb;
```

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/plan/upcoming` | GET | Returns planned_workouts for the next 14 days (used by calendar) |
| `/api/plan/regenerate` | POST | Cron endpoint — generates next week's plan |
| `/api/plan/approve` | POST | Marks a week's planned_workouts as approved |
| `/api/plan/edit` | POST | Coach tool endpoint — create/update/delete planned_workouts |

### Dashboard Data Flow

1. Calendar page fetches both `/api/test-data` (actual activity) AND `/api/plan/upcoming` (planned workouts)
2. For each day column:
   - **Future days:** render planned cards (greyed, dashed border)
   - **Past days:** render actual activity cards (colored) + compliance badge
   - **Today:** both if applicable

### Coach Tool Integration

The coach chat uses Claude `tool_use` with tools:
- `read_plan`, `read_activity`, `read_recovery` — read-only data access
- `update_plan`, `create_workouts`, `delete_workouts` — mutation tools

Each tool calls the corresponding Supabase query in the API route. After tool execution, the coach summarizes what changed.

### Cron Schedule

- Next.js cron route (`/api/plan/regenerate`) runs Sundays at 10pm UTC
- Protected by API secret header
- Timezone-aware scheduling deferred to later iteration
