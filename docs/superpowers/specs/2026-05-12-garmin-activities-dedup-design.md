# Garmin Activity Sync + Dedup + Detail Modal — Design Spec

**Date:** 2026-05-12
**Status:** Approved
**Approach:** Extended cardio_logs + new columns (Approach A)

## Overview

Pull activity data from Garmin Connect (runs, rides, swims) in addition to the existing recovery/wellness data. Merge with Strava activities using time-based deduplication — Strava provides GPS-accurate distance/pace/elevation, Garmin provides training effect, VO2 max, HR zones, running dynamics, and per-km splits. Display enriched data on calendar cards and in a full activity detail modal with timeline charts, HR zone analysis, and splits table.

## 1. Garmin Activity Sync

### New fields pulled from Garmin

| Field | Type | Source |
|---|---|---|
| `training_effect_aerobic` | numeric | Activity summary (0-5 scale) |
| `training_effect_anaerobic` | numeric | Activity summary (0-5 scale) |
| `vo2_max` | numeric | Activity summary |
| `max_hr` | integer | Activity summary |
| `hr_zones` | jsonb | Array of `{zone: 1, low: 120, high: 140, minutes: 12.5}` |
| `recovery_time_min` | integer | Minutes until recovered |
| `avg_respiration` | numeric | Breaths per minute |
| `avg_cadence` | numeric | Steps/min (running) or RPM (cycling) |
| `avg_stride_length` | numeric | Meters |
| `ground_contact_time` | numeric | Milliseconds (running only) |
| `splits` | jsonb | Array of per-km splits: `{km: 1, pace_min_km: 5.4, avg_hr: 145, elevation: 12, cadence: 172}` |
| `source` | text | "strava", "garmin", or "merged" |
| `start_time` | timestamptz | Activity start time (for dedup matching) |

### Python service changes

New `fetch_activities(client, since)` function in `garmin_client.py`:
- Calls `client.get_activities_by_date(since, today)` for the activity list
- Calls `client.get_activity(activity_id)` for each activity to get splits and detailed metrics
- Maps Garmin activity types to `run|bike|swim|other`
- Returns array of activity objects with all fields above

New `/sync-activities` endpoint in `main.py` (separate from `/sync` which handles recovery data).

### Express backend changes

New `syncGarminActivities` worker in `server/src/sync/garmin.ts`:
- Calls the Python service's `/sync-activities`
- Receives activity array
- Runs dedup logic against existing `cardio_logs` rows
- Upserts merged/new rows

### Strava sync update

- Populate `start_time` from Strava's `start_date_local` (currently not stored)
- Set `source: "strava"` on new rows

## 2. Deduplication Logic

### When

During Garmin activity sync, before inserting into `cardio_logs`.

### Matching criteria

A Garmin activity matches a Strava activity if ALL of:
1. Same date
2. Same type (run/bike/swim) — Garmin types mapped to `run|bike|swim|other` enum
3. Start times within 10 minutes of each other (uses `start_time` column)
4. Duration within 20% of each other (guards against matching e.g., morning easy run with evening tempo run)

### Merge behavior when matched

| Field | Keep from |
|---|---|
| `distance`, `duration`, `pace_or_speed`, `elevation` | Strava (GPS more accurate) |
| `training_effect_aerobic`, `training_effect_anaerobic`, `vo2_max`, `max_hr`, `hr_zones`, `recovery_time_min`, `avg_respiration`, `avg_cadence`, `avg_stride_length`, `ground_contact_time`, `splits` | Garmin |
| `avg_hr`, `calories` | Garmin preferred, Strava as fallback |
| `source` | Set to `"merged"` |

### When no match

Insert as a new `cardio_logs` row with `source: "garmin"`.

### Existing Strava rows without Garmin match

Unchanged, stay as `source: "strava"`.

## 3. Detail Modal

### Trigger

Clicking any cardio card on the calendar opens the activity detail modal.

### Layout — three tabs

**Timeline tab (default):**
- Pace line chart (min/km) over distance — from `splits` data
- HR line chart overlaid on same x-axis
- Cadence line chart (smaller, below)
- Elevation area chart (bottom)
- Split markers (vertical dashed lines at each km)
- Built with recharts

**HR tab:**
- HR zone table: zone name, HR range, time spent, percentage, progress bar
- HR histogram: bar chart showing minutes per 5-bpm bucket
- Cumulative time chart: log-scale curve showing total time above each HR value

**Data tab:**
- Splits table: km | pace | HR | elevation | cadence — one row per split
- Summary stats: training effect (aerobic/anaerobic), VO2 max, recovery time, respiration rate, stride length, ground contact time
- Source badge showing where data came from (Strava, Garmin, or Merged)

### Modal header

- Activity type icon + name + date
- Key metrics row: distance, duration, avg pace, avg HR, max HR, calories, elevation

## 4. Calendar Card Enhancements

### Enhanced cardio cards add

- **Training Effect badge** — small colored pill: green (1-2 maintaining), yellow (2-3 improving), orange (3-4 highly improving), red (4-5 overreaching)
- **Max HR** next to avg HR — "♥ 145 / 178" format
- **Source indicator** — tiny dot: orange for Strava, blue for Garmin, purple for Merged
- **VO2 max** shown only if present — small text

Cards stay compact. Real Training Effect replaces estimated TRIMP load.

### Recovery bar enhanced

- Add recovery time if any activity that day had one — e.g., "Recover 24h"

## 5. Database Migration

```sql
-- 005_garmin_activities.sql
ALTER TABLE public.cardio_logs
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS max_hr integer,
  ADD COLUMN IF NOT EXISTS training_effect_aerobic numeric,
  ADD COLUMN IF NOT EXISTS training_effect_anaerobic numeric,
  ADD COLUMN IF NOT EXISTS vo2_max numeric,
  ADD COLUMN IF NOT EXISTS recovery_time_min integer,
  ADD COLUMN IF NOT EXISTS avg_respiration numeric,
  ADD COLUMN IF NOT EXISTS avg_cadence numeric,
  ADD COLUMN IF NOT EXISTS avg_stride_length numeric,
  ADD COLUMN IF NOT EXISTS ground_contact_time numeric,
  ADD COLUMN IF NOT EXISTS hr_zones jsonb,
  ADD COLUMN IF NOT EXISTS splits jsonb,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'strava';
```

All nullable, no breaking changes to existing data.

## 6. Sync Order

1. Strava sync runs first (already on cron)
2. Garmin recovery sync (`/sync`) runs second
3. Garmin activity sync (`/sync-activities`) runs third — finds existing Strava rows to merge into

## 7. API / Data Flow

- `/api/test-data` already returns `cardio_logs` with `select("*")` — new columns automatically included
- `CardioLog` TypeScript interface on the dashboard extended with new fields
- `CardioCard` component updated to show TE badge, max HR, source dot, VO2 max
- New `ActivityDetailModal` component with 3 tabs
- Clicking a cardio card opens the modal (currently only workout cards have detail modals)
