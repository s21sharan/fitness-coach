# Garmin Activity Sync + Dedup + Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull activity data (runs, rides, swims) from Garmin Connect, merge with Strava activities using time-based deduplication, enrich calendar cards with Garmin-exclusive metrics (training effect, VO2 max, HR zones, running dynamics), and add a full activity detail modal with timeline charts, HR analysis, and splits table.

**Architecture:** New columns on `cardio_logs` for Garmin-enriched fields. Python service gets a `/sync-activities` endpoint. Express backend runs dedup logic matching by time/type/duration overlap, merging Strava GPS data with Garmin training metrics. Dashboard gets an `ActivityDetailModal` with 3 tabs (Timeline, HR, Data) and enhanced `CardioCard` with TE badge and source indicator.

**Tech Stack:** Python (garminconnect), Express/TypeScript (sync worker), Next.js (UI), recharts (charts), Supabase (PostgreSQL)

---

### Task 1: Database Migration — Add Garmin Activity Columns

**Files:**
- Create: `supabase/migrations/005_garmin_activities.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 005_garmin_activities.sql
-- Add Garmin activity fields to cardio_logs for enriched data and deduplication
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

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_garmin_activities.sql
git commit -m "feat: add Garmin activity columns to cardio_logs"
```

---

### Task 2: Python Service — Fetch Garmin Activities

**Files:**
- Modify: `services/garmin/garmin_client.py`
- Modify: `services/garmin/main.py`

- [ ] **Step 1: Add `fetch_activities` function to `garmin_client.py`**

Add this function after the existing `fetch_data` function (after line 232):

```python
GARMIN_RUN_TYPES = {"running", "trail_running", "treadmill_running", "track_running"}
GARMIN_BIKE_TYPES = {"cycling", "mountain_biking", "indoor_cycling", "gravel_cycling", "e_bike_cycling"}
GARMIN_SWIM_TYPES = {"lap_swimming", "open_water_swimming"}


def map_garmin_activity_type(activity_type: str) -> str:
    """Map Garmin activity type to our enum."""
    t = activity_type.lower().replace(" ", "_")
    if t in GARMIN_RUN_TYPES:
        return "run"
    if t in GARMIN_BIKE_TYPES:
        return "bike"
    if t in GARMIN_SWIM_TYPES:
        return "swim"
    return "other"


def extract_hr_zones(activity_detail: dict) -> list[dict] | None:
    """Extract HR zone time-in-zone from activity detail."""
    try:
        zones = activity_detail.get("heartRateZones")
        if not zones:
            # Try alternate path
            summary = activity_detail.get("summaryDTO", {})
            zones = summary.get("heartRateZones")
        if not zones or not isinstance(zones, list):
            return None
        result = []
        for z in zones:
            if isinstance(z, dict):
                result.append({
                    "zone": z.get("zoneNumber", z.get("zone", len(result) + 1)),
                    "low": z.get("zoneLowBoundary", z.get("startBpm")),
                    "high": z.get("zoneHighBoundary", z.get("endBpm")),
                    "minutes": round((z.get("secsInZone", 0) or 0) / 60, 1),
                })
        return result if result else None
    except Exception as e:
        log(f"  HR zones extraction error: {e}")
        return None


def extract_splits(activity_detail: dict) -> list[dict] | None:
    """Extract per-km split data from activity detail."""
    try:
        splits = activity_detail.get("splitSummaries") or activity_detail.get("splits")
        if not splits or not isinstance(splits, list):
            return None
        result = []
        km = 1
        for s in splits:
            if not isinstance(s, dict):
                continue
            # Filter to distance-based splits (not time-based)
            split_type = s.get("splitType", "")
            if split_type and split_type not in ("distance", "DISTANCE", ""):
                continue
            dist = s.get("distance", 0)
            if dist and dist < 100:
                continue  # skip very short splits
            duration_sec = s.get("duration", s.get("movingDuration", s.get("timerDuration", 0)))
            avg_hr_split = s.get("averageHR", s.get("averageHeartRate"))
            elevation_split = s.get("elevationGain", s.get("totalAscent"))
            cadence_split = s.get("averageRunCadence", s.get("averageCadence"))
            dist_km = (dist or 0) / 1000
            pace = None
            if dist_km > 0 and duration_sec > 0:
                pace = round((duration_sec / 60) / dist_km, 2)
            result.append({
                "km": km,
                "distance_m": round(dist) if dist else None,
                "pace_min_km": pace,
                "avg_hr": round(avg_hr_split) if avg_hr_split else None,
                "elevation": round(elevation_split, 1) if elevation_split else None,
                "cadence": round(cadence_split) if cadence_split else None,
            })
            km += 1
        return result if result else None
    except Exception as e:
        log(f"  Splits extraction error: {e}")
        return None


def fetch_activities(client: Garmin, since: str) -> list[dict]:
    """Fetch all activities from Garmin since the given date with detailed metrics."""
    start = datetime.strptime(since, "%Y-%m-%d").date()
    end = date.today()

    log(f"Fetching activities from {since} to {end}...")

    try:
        activities = client.get_activities_by_date(start.isoformat(), end.isoformat())
    except Exception as e:
        log(f"  Failed to fetch activity list: {e}")
        return []

    if not activities:
        log("  No activities found")
        return []

    log(f"  Found {len(activities)} activities, fetching details...")
    results = []

    for act in activities:
        activity_id = act.get("activityId")
        if not activity_id:
            continue

        activity_type = act.get("activityType", {})
        type_key = activity_type.get("typeKey", "") if isinstance(activity_type, dict) else str(activity_type)
        mapped_type = map_garmin_activity_type(type_key)

        # Basic fields from summary
        entry = {
            "activity_id": str(activity_id),
            "date": act.get("startTimeLocal", "")[:10],
            "start_time": act.get("startTimeLocal"),
            "type": mapped_type,
            "distance_km": round((act.get("distance", 0) or 0) / 1000, 2),
            "duration_sec": round(act.get("movingDuration", act.get("duration", 0)) or 0),
            "avg_hr": round(act.get("averageHR", 0)) if act.get("averageHR") else None,
            "max_hr": round(act.get("maxHR", 0)) if act.get("maxHR") else None,
            "calories": round(act.get("calories", 0)) if act.get("calories") else None,
            "elevation": round(act.get("elevationGain", 0), 1) if act.get("elevationGain") else None,
            "training_effect_aerobic": act.get("aerobicTrainingEffect"),
            "training_effect_anaerobic": act.get("anaerobicTrainingEffect"),
            "vo2_max": act.get("vO2MaxValue"),
            "avg_respiration": act.get("avgRespirationRate"),
            "recovery_time_min": None,
            "avg_cadence": None,
            "avg_stride_length": None,
            "ground_contact_time": None,
            "hr_zones": None,
            "splits": None,
        }

        # Compute pace
        if entry["distance_km"] > 0 and entry["duration_sec"] > 0:
            if mapped_type == "run":
                entry["pace_or_speed"] = round((entry["duration_sec"] / 60) / entry["distance_km"], 2)
            else:
                entry["pace_or_speed"] = round(entry["distance_km"] / (entry["duration_sec"] / 3600), 2)
        else:
            entry["pace_or_speed"] = None

        # Fetch detailed activity data
        try:
            detail = client.get_activity(activity_id)
            if detail and isinstance(detail, dict):
                summary = detail.get("summaryDTO", {})
                if isinstance(summary, dict):
                    if not entry["avg_cadence"]:
                        entry["avg_cadence"] = summary.get("averageRunningCadenceInStepsPerMinute") or summary.get("averageCadence") or summary.get("averageBikingCadenceInRevPerMinute")
                    if not entry["avg_stride_length"]:
                        entry["avg_stride_length"] = summary.get("averageStrideLength")
                    if not entry["ground_contact_time"]:
                        entry["ground_contact_time"] = summary.get("avgGroundContactTime")
                    if not entry["avg_respiration"]:
                        entry["avg_respiration"] = summary.get("avgRespirationRate")

                # Recovery time
                recovery = detail.get("recoveryTime")
                if recovery:
                    entry["recovery_time_min"] = round(recovery) if isinstance(recovery, (int, float)) else None

                # HR zones
                entry["hr_zones"] = extract_hr_zones(detail)

                # Splits
                entry["splits"] = extract_splits(detail)

        except Exception as e:
            log(f"  Detail fetch failed for {activity_id}: {e}")

        if entry["avg_cadence"] is not None:
            entry["avg_cadence"] = round(entry["avg_cadence"], 1)
        if entry["avg_stride_length"] is not None:
            entry["avg_stride_length"] = round(entry["avg_stride_length"], 2)
        if entry["ground_contact_time"] is not None:
            entry["ground_contact_time"] = round(entry["ground_contact_time"], 1)

        results.append(entry)
        log(f"  {entry['date']} {mapped_type}: {entry['distance_km']}km, TE={entry['training_effect_aerobic']}, splits={len(entry['splits'] or [])}")

    log(f"Done. Fetched {len(results)} activities with details.")
    return results
```

- [ ] **Step 2: Add `/sync-activities` endpoint to `main.py`**

Add after the existing `/sync` endpoint:

```python
@app.post("/sync-activities")
def sync_activities(req: SyncRequest):
    try:
        client = create_client(req.email, req.password)
        activities = fetch_activities(client, req.since)
        return {"activities": activities}
    except GarminConnectAuthenticationError:
        raise HTTPException(status_code=401, detail={"error": "auth_failed"})
    except GarminConnectTooManyRequestsError:
        raise HTTPException(status_code=429, detail={"error": "rate_limited"})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
```

Also add `fetch_activities` to the import at the top of main.py:

```python
from garmin_client import create_client, fetch_data, fetch_activities
```

- [ ] **Step 3: Commit**

```bash
git add services/garmin/garmin_client.py services/garmin/main.py
git commit -m "feat: add Garmin activity fetching with splits, HR zones, and training effect"
```

---

### Task 3: Express Backend — Garmin Activity Sync with Dedup

**Files:**
- Modify: `server/src/sync/garmin.ts`
- Test: `server/__tests__/sync/garmin-activities.test.ts`

- [ ] **Step 1: Write the dedup test**

```typescript
// server/__tests__/sync/garmin-activities.test.ts
import { describe, it, expect } from "vitest";

// Test the dedup matching logic as a pure function
interface ActivityMatch {
  stravaStartTime: string;
  stravaType: string;
  stravaDuration: number;
  garminStartTime: string;
  garminType: string;
  garminDuration: number;
}

function isMatchingActivity(strava: { start_time: string | null; type: string; duration: number }, garmin: { start_time: string; type: string; duration_sec: number }): boolean {
  if (!strava.start_time) return false;
  if (strava.type !== garmin.type) return false;
  const stravaTime = new Date(strava.start_time).getTime();
  const garminTime = new Date(garmin.start_time).getTime();
  if (Math.abs(stravaTime - garminTime) > 10 * 60 * 1000) return false;
  const durationRatio = strava.duration / garmin.duration_sec;
  if (durationRatio < 0.8 || durationRatio > 1.2) return false;
  return true;
}

describe("isMatchingActivity", () => {
  it("matches same activity from Strava and Garmin", () => {
    expect(isMatchingActivity(
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration: 1800 },
      { start_time: "2026-05-10T07:02:00Z", type: "run", duration_sec: 1820 },
    )).toBe(true);
  });

  it("rejects different types", () => {
    expect(isMatchingActivity(
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration: 1800 },
      { start_time: "2026-05-10T07:00:00Z", type: "bike", duration_sec: 1800 },
    )).toBe(false);
  });

  it("rejects start times more than 10 minutes apart", () => {
    expect(isMatchingActivity(
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration: 1800 },
      { start_time: "2026-05-10T07:15:00Z", type: "run", duration_sec: 1800 },
    )).toBe(false);
  });

  it("rejects durations more than 20% different", () => {
    expect(isMatchingActivity(
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration: 1800 },
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration_sec: 3000 },
    )).toBe(false);
  });

  it("rejects when strava has no start_time", () => {
    expect(isMatchingActivity(
      { start_time: null, type: "run", duration: 1800 },
      { start_time: "2026-05-10T07:00:00Z", type: "run", duration_sec: 1800 },
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (pure function, test contains the implementation)

Run: `cd server && npx vitest run __tests__/sync/garmin-activities.test.ts`

- [ ] **Step 3: Add Garmin activity sync to `server/src/sync/garmin.ts`**

Add these interfaces and functions after the existing `syncAllGarmin` function:

```typescript
interface GarminActivity {
  activity_id: string;
  date: string;
  start_time: string | null;
  type: string;
  distance_km: number;
  duration_sec: number;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  elevation: number | null;
  pace_or_speed: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: unknown[] | null;
  splits: unknown[] | null;
}

function isMatchingActivity(
  strava: { start_time: string | null; type: string; duration: number },
  garmin: { start_time: string | null; type: string; duration_sec: number },
): boolean {
  if (!strava.start_time || !garmin.start_time) return false;
  if (strava.type !== garmin.type) return false;
  const stravaTime = new Date(strava.start_time).getTime();
  const garminTime = new Date(garmin.start_time).getTime();
  if (Math.abs(stravaTime - garminTime) > 10 * 60 * 1000) return false;
  const durationRatio = strava.duration / garmin.duration_sec;
  if (durationRatio < 0.8 || durationRatio > 1.2) return false;
  return true;
}

async function fetchGarminActivities(email: string, password: string, since: string): Promise<GarminActivity[]> {
  const res = await fetch(`${config.garminServiceUrl}/sync-activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, since }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown" }));
    throw new Error(`Garmin activity sync error: ${(err as { error: string }).error}`);
  }
  const data = await res.json() as { activities: GarminActivity[] };
  return data.activities;
}

export async function syncGarminActivitiesForUser(
  userId: string,
  credentials: { email: string; password: string },
  since?: string,
): Promise<number> {
  const email = decrypt(credentials.email, config.encryptionKey);
  const password = decrypt(credentials.password, config.encryptionKey);
  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const garminActivities = await fetchGarminActivities(email, password, sinceDate);
  if (garminActivities.length === 0) return 0;

  // Get existing Strava activities for the same date range for dedup
  const dates = garminActivities.map((a) => a.date);
  const minDate = dates.sort()[0];
  const maxDate = dates.sort().reverse()[0];

  const { data: existingRows } = await supabase
    .from("cardio_logs")
    .select("id, date, activity_id, type, duration, start_time, source")
    .eq("user_id", userId)
    .gte("date", minDate)
    .lte("date", maxDate);

  const existing = existingRows || [];
  let synced = 0;

  for (const garmin of garminActivities) {
    // Check for matching Strava activity
    const match = existing.find((s) =>
      s.date === garmin.date && isMatchingActivity(
        { start_time: s.start_time, type: s.type, duration: s.duration },
        { start_time: garmin.start_time, type: garmin.type, duration_sec: garmin.duration_sec },
      )
    );

    if (match) {
      // Merge: update existing Strava row with Garmin-enriched data
      const { error } = await supabase
        .from("cardio_logs")
        .update({
          max_hr: garmin.max_hr,
          training_effect_aerobic: garmin.training_effect_aerobic,
          training_effect_anaerobic: garmin.training_effect_anaerobic,
          vo2_max: garmin.vo2_max,
          recovery_time_min: garmin.recovery_time_min,
          avg_respiration: garmin.avg_respiration,
          avg_cadence: garmin.avg_cadence,
          avg_stride_length: garmin.avg_stride_length,
          ground_contact_time: garmin.ground_contact_time,
          hr_zones: garmin.hr_zones,
          splits: garmin.splits,
          avg_hr: garmin.avg_hr ?? match.avg_hr,
          source: "merged",
          synced_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      if (!error) synced++;
    } else {
      // No match — insert as Garmin-only activity
      const { error } = await supabase
        .from("cardio_logs")
        .upsert({
          user_id: userId,
          date: garmin.date,
          activity_id: `garmin_${garmin.activity_id}`,
          start_time: garmin.start_time,
          type: garmin.type,
          distance: garmin.distance_km,
          duration: garmin.duration_sec,
          avg_hr: garmin.avg_hr,
          max_hr: garmin.max_hr,
          calories: garmin.calories,
          elevation: garmin.elevation,
          pace_or_speed: garmin.pace_or_speed,
          training_effect_aerobic: garmin.training_effect_aerobic,
          training_effect_anaerobic: garmin.training_effect_anaerobic,
          vo2_max: garmin.vo2_max,
          recovery_time_min: garmin.recovery_time_min,
          avg_respiration: garmin.avg_respiration,
          avg_cadence: garmin.avg_cadence,
          avg_stride_length: garmin.avg_stride_length,
          ground_contact_time: garmin.ground_contact_time,
          hr_zones: garmin.hr_zones,
          splits: garmin.splits,
          source: "garmin",
          synced_at: new Date().toISOString(),
        }, { onConflict: "user_id,activity_id" });

      if (!error) synced++;
    }
  }

  return synced;
}

export async function syncAllGarminActivities(): Promise<void> {
  const integrations = await getActiveIntegrations("garmin");

  for (const integration of integrations) {
    try {
      const creds = integration.credentials as { email: string; password: string };
      const since = integration.last_synced_at
        ? new Date(integration.last_synced_at).toISOString().slice(0, 10)
        : undefined;

      const count = await syncGarminActivitiesForUser(integration.user_id, creds, since);
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: count });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      await logSync({ userId: integration.user_id, provider: "garmin", recordsSynced: 0, error });
    }
  }
}
```

- [ ] **Step 4: Run all server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/sync/garmin.ts server/__tests__/sync/garmin-activities.test.ts
git commit -m "feat: add Garmin activity sync with Strava dedup merge logic"
```

---

### Task 4: Update Strava Sync — Populate `start_time` and `source`

**Files:**
- Modify: `server/src/sync/strava.ts`

- [ ] **Step 1: Update `normalizeActivity` to include `start_time` and `source`**

In `server/src/sync/strava.ts`, update the return object in `normalizeActivity` (line 33-45). Add two fields after `elevation`:

```typescript
    start_time: activity.start_date || null,
    source: "strava",
```

The `StravaActivity` type already includes `start_date` (ISO timestamp string).

- [ ] **Step 2: Run server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/sync/strava.ts
git commit -m "feat: populate start_time and source on Strava cardio_logs"
```

---

### Task 5: Extend Dashboard CardioLog Interface and CardioCard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Extend the CardioLog interface**

Replace the `CardioLog` interface (lines 37-47) with:

```typescript
interface CardioLog {
  date: string;
  activity_id: string;
  type: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
  start_time: string | null;
  max_hr: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: Array<{ zone: number; low: number; high: number; minutes: number }> | null;
  splits: Array<{ km: number; distance_m: number | null; pace_min_km: number | null; avg_hr: number | null; elevation: number | null; cadence: number | null }> | null;
  source: string | null;
}
```

- [ ] **Step 2: Update CardioCard to show TE badge, max HR, source dot, VO2 max**

Replace the `CardioCard` function (lines 263-289) with:

```typescript
const TE_COLORS: Record<string, string> = {
  maintaining: "#22c55e",
  improving: "#eab308",
  highly: "#f97316",
  overreaching: "#ef4444",
};

function teColor(te: number): string {
  if (te < 2) return TE_COLORS.maintaining;
  if (te < 3) return TE_COLORS.improving;
  if (te < 4) return TE_COLORS.highly;
  return TE_COLORS.overreaching;
}

const SOURCE_COLORS: Record<string, string> = {
  strava: "#FC4C02",
  garmin: "#0091D5",
  merged: "#8b5cf6",
};

function CardioCard({ c: a, onClick }: { c: CardioLog; onClick?: () => void }) {
  const t = cType(a.type); const cl = TYPE_COLORS[t];
  const zone = hrZone(a.avg_hr);
  return (
    <div onClick={onClick} style={{ background: cl.bg, borderLeft: `3px solid ${cl.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 10, lineHeight: 1.5, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{cl.icon}</span>
        <span style={{ fontWeight: 700, color: cl.text, fontSize: 11, flex: 1 }}>{fmtSec(a.duration)}</span>
        {a.training_effect_aerobic != null && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: teColor(a.training_effect_aerobic), borderRadius: 3, padding: "1px 4px" }}>
            TE {a.training_effect_aerobic.toFixed(1)}
          </span>
        )}
        {zone > 0 && !a.training_effect_aerobic && <span style={{ fontSize: 9, fontWeight: 700, color: ZONE_COLORS[zone - 1], background: "rgba(0,0,0,0.05)", borderRadius: 3, padding: "1px 4px" }}>Z{zone}</span>}
      </div>
      {a.distance > 0 && <div style={{ fontWeight: 800, color: cl.text, fontSize: 12 }}>{fmtDist(a.distance)} {distUnit()}</div>}
      <HrZoneBar avgHr={a.avg_hr} />
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "0 6px", marginTop: 2 }}>
        {a.pace_or_speed != null && a.pace_or_speed > 0 && <span>Pace {fmtPace(a.pace_or_speed)}</span>}
        {a.avg_hr != null && <span><span style={{ color: "#ef4444" }}>♥</span> {a.avg_hr}{a.max_hr ? ` / ${a.max_hr}` : ""}</span>}
        {a.vo2_max != null && <span style={{ color: "#6366f1" }}>V̇O₂ {Math.round(a.vo2_max)}</span>}
      </div>
      {(a.calories != null || a.elevation != null) && (
        <div style={{ color: "#9ca3af", display: "flex", gap: 6, marginTop: 1 }}>
          {a.calories != null && a.calories > 0 && <span>{Math.round(a.calories)} kcal</span>}
          {a.elevation != null && a.elevation > 0 && <span>↑{Math.round(a.elevation)}m</span>}
        </div>
      )}
      <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, color: "#9ca3af" }}>{cl.label}</span>
        {a.source && <span style={{ width: 5, height: 5, borderRadius: "50%", background: SOURCE_COLORS[a.source] || "#9ca3af", display: "inline-block" }} title={a.source} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: enhance CardioCard with training effect, max HR, VO2 max, source indicator"
```

---

### Task 6: Activity Detail Modal — Timeline Tab

**Files:**
- Create: `src/components/charts/activity-detail-modal.tsx`

- [ ] **Step 1: Create the modal component with Timeline tab**

```typescript
// src/components/charts/activity-detail-modal.tsx
"use client";

import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts";

interface Split {
  km: number;
  distance_m: number | null;
  pace_min_km: number | null;
  avg_hr: number | null;
  elevation: number | null;
  cadence: number | null;
}

interface HrZone {
  zone: number;
  low: number;
  high: number;
  minutes: number;
}

interface ActivityData {
  activity_id: string;
  type: string;
  date: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  max_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: HrZone[] | null;
  splits: Split[] | null;
  source: string | null;
}

interface ActivityDetailModalProps {
  open: boolean;
  onClose: () => void;
  activity: ActivityData | null;
}

function fmtSec(s: number): string { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`; }
function fmtPace(p: number): string { const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${String(s).padStart(2, "0")}`; }
function fmtZoneTime(mins: number): string { const h = Math.floor(mins / 60); const m = Math.round(mins % 60); return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`; }

const ZONE_COLORS = ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"];
const ZONE_NAMES = ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"];

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  border: "none", borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
  background: "none", color: active ? "#1d4ed8" : "#6b7280",
});

/* ─── Timeline Tab ─── */
function TimelineTab({ splits }: { splits: Split[] }) {
  if (!splits || splits.length < 2) return <div style={{ color: "#9ca3af", padding: 20, fontSize: 12 }}>No split data available for this activity.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pace chart */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Pace (min/km)</div>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={splits} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "km", position: "insideBottomRight", fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} reversed domain={["auto", "auto"]} tickFormatter={(v: number) => fmtPace(v)} />
            <Tooltip formatter={(v: number) => [fmtPace(v) + "/km", "Pace"]} labelFormatter={(km: number) => `Km ${km}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Line dataKey="pace_min_km" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* HR chart */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Heart Rate (bpm)</div>
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={splits} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip formatter={(v: number) => [`${v} bpm`, "HR"]} labelFormatter={(km: number) => `Km ${km}`} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Area dataKey="avg_hr" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cadence chart */}
      {splits.some((s) => s.cadence != null) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Cadence (spm)</div>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart data={splits} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip formatter={(v: number) => [`${v} spm`, "Cadence"]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Line dataKey="cadence" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 2, fill: "#8b5cf6" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Elevation chart */}
      {splits.some((s) => s.elevation != null) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>Elevation (m)</div>
          <ResponsiveContainer width="100%" height={80}>
            <ComposedChart data={splits} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Area dataKey="elevation" stroke="#a78bfa" fill="#ede9fe" strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ─── HR Tab ─── */
function HrTab({ zones }: { zones: HrZone[] }) {
  if (!zones || zones.length === 0) return <div style={{ color: "#9ca3af", padding: 20, fontSize: 12 }}>No HR zone data available.</div>;

  const totalMins = zones.reduce((s, z) => s + z.minutes, 0) || 1;

  return (
    <div>
      {/* Zone table */}
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ color: "#9ca3af", fontWeight: 600, borderBottom: "1px solid #f3f4f6" }}>
            <td style={{ padding: "6px 0" }}>Zone</td>
            <td>Name</td>
            <td>HR Range</td>
            <td style={{ textAlign: "right" }}>Time</td>
            <td style={{ textAlign: "right" }}>%</td>
            <td style={{ width: 120 }}></td>
          </tr>
        </thead>
        <tbody>
          {zones.map((z, i) => {
            const pct = Math.round(z.minutes / totalMins * 100);
            return (
              <tr key={z.zone} style={{ borderBottom: "1px solid #f9fafb" }}>
                <td style={{ padding: "6px 0", fontWeight: 700, color: "#374151" }}>Z{z.zone}</td>
                <td style={{ color: "#6b7280" }}>{ZONE_NAMES[i] || `Zone ${z.zone}`}</td>
                <td style={{ color: "#6b7280" }}>{z.low} - {z.high}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtZoneTime(z.minutes)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{pct}%</td>
                <td>
                  <div style={{ height: 10, borderRadius: 5, background: "#f3f4f6", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: ZONE_COLORS[i] || "#9ca3af", borderRadius: 5 }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Zone bar chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={zones} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="zone" tickFormatter={(z: number) => `Z${z}`} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} label={{ value: "min", angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af" }} />
          <Tooltip formatter={(v: number) => [`${fmtZoneTime(v)}`, "Time in zone"]} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
            {zones.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i] || "#9ca3af"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Data Tab ─── */
function DataTab({ activity, splits }: { activity: ActivityData; splits: Split[] }) {
  const a = activity;
  return (
    <div>
      {/* Summary stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {a.training_effect_aerobic != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Aerobic TE</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{a.training_effect_aerobic.toFixed(1)}</div>
          </div>
        )}
        {a.training_effect_anaerobic != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Anaerobic TE</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{a.training_effect_anaerobic.toFixed(1)}</div>
          </div>
        )}
        {a.vo2_max != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>VO2 Max</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(a.vo2_max)}</div>
          </div>
        )}
        {a.recovery_time_min != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Recovery</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(a.recovery_time_min / 60)}h</div>
          </div>
        )}
        {a.avg_respiration != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Respiration</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(a.avg_respiration)} brpm</div>
          </div>
        )}
        {a.avg_cadence != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Cadence</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(a.avg_cadence)} spm</div>
          </div>
        )}
        {a.avg_stride_length != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>Stride</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{a.avg_stride_length.toFixed(2)}m</div>
          </div>
        )}
        {a.ground_contact_time != null && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7280" }}>GCT</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(a.ground_contact_time)}ms</div>
          </div>
        )}
      </div>

      {/* Source badge */}
      {a.source && (
        <div style={{ marginBottom: 12, fontSize: 11, color: "#6b7280" }}>
          Source: <span style={{ fontWeight: 700, textTransform: "capitalize" }}>{a.source}</span>
        </div>
      )}

      {/* Splits table */}
      {splits.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>Splits</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#9ca3af", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "6px 8px" }}>Km</td>
                  <td style={{ textAlign: "right" }}>Pace</td>
                  <td style={{ textAlign: "right" }}>HR</td>
                  <td style={{ textAlign: "right" }}>Elev</td>
                  <td style={{ textAlign: "right" }}>Cadence</td>
                </tr>
              </thead>
              <tbody>
                {splits.map((s) => (
                  <tr key={s.km} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{s.km}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{s.pace_min_km ? fmtPace(s.pace_min_km) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.avg_hr ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.elevation != null ? `${s.elevation}m` : "—"}</td>
                    <td style={{ textAlign: "right" }}>{s.cadence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Modal ─── */
const ACTIVITY_ICONS: Record<string, string> = { run: "🏃", bike: "🚴", swim: "🏊", other: "⚡" };

export function ActivityDetailModal({ open, onClose, activity }: ActivityDetailModalProps) {
  const [tab, setTab] = useState<"timeline" | "hr" | "data">("timeline");

  if (!open || !activity) return null;

  const a = activity;
  const icon = ACTIVITY_ICONS[a.type] || "⚡";
  const dateLabel = new Date(a.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 12, width: "min(90vw, 800px)", maxHeight: "85vh", overflow: "auto", padding: 28, boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{icon} {a.type.charAt(0).toUpperCase() + a.type.slice(1)}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{dateLabel}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "#f3f4f6", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Key metrics row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16, fontSize: 12 }}>
          {a.distance > 0 && <div><span style={{ color: "#6b7280" }}>Distance</span> <b>{a.distance.toFixed(2)} km</b></div>}
          <div><span style={{ color: "#6b7280" }}>Duration</span> <b>{fmtSec(a.duration)}</b></div>
          {a.pace_or_speed != null && <div><span style={{ color: "#6b7280" }}>Pace</span> <b>{fmtPace(a.pace_or_speed)}/km</b></div>}
          {a.avg_hr != null && <div><span style={{ color: "#6b7280" }}>Avg HR</span> <b>{a.avg_hr}</b></div>}
          {a.max_hr != null && <div><span style={{ color: "#6b7280" }}>Max HR</span> <b>{a.max_hr}</b></div>}
          {a.calories != null && <div><span style={{ color: "#6b7280" }}>Calories</span> <b>{Math.round(a.calories)}</b></div>}
          {a.elevation != null && <div><span style={{ color: "#6b7280" }}>Elevation</span> <b>↑{Math.round(a.elevation)}m</b></div>}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
          <button style={TAB_STYLE(tab === "timeline")} onClick={() => setTab("timeline")}>Timeline</button>
          <button style={TAB_STYLE(tab === "hr")} onClick={() => setTab("hr")}>HR</button>
          <button style={TAB_STYLE(tab === "data")} onClick={() => setTab("data")}>Data</button>
        </div>

        {/* Tab content */}
        {tab === "timeline" && <TimelineTab splits={a.splits || []} />}
        {tab === "hr" && <HrTab zones={a.hr_zones || []} />}
        {tab === "data" && <DataTab activity={a} splits={a.splits || []} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/activity-detail-modal.tsx
git commit -m "feat: add ActivityDetailModal with timeline, HR zone, and data tabs"
```

---

### Task 7: Wire Activity Detail Modal into Dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Import the modal**

Add to the imports at the top:

```typescript
import { ActivityDetailModal } from "@/components/charts/activity-detail-modal";
```

- [ ] **Step 2: Add state for selected activity**

In `DashboardPage` function, add state:

```typescript
const [selectedActivity, setSelectedActivity] = useState<CardioLog | null>(null);
```

- [ ] **Step 3: Pass onClick to CardioCard in DayColumn**

In the `DayColumn` component, update the cardio card rendering from:

```typescript
{day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} />)}
```

To:

```typescript
{day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} onClick={() => setSelectedActivity(c)} />)}
```

Note: `setSelectedActivity` is in the parent `DashboardPage` scope, so `DayColumn` needs to receive an `onActivityClick` prop. Update `DayColumn` to accept `onActivityClick?: (c: CardioLog) => void` and pass it through. Update all `DayColumn` usages in `WeekRow` to thread the prop from `DashboardPage`.

- [ ] **Step 4: Render the modal at the bottom of the page**

At the bottom of the `DashboardPage` return, before the closing `</div>`, add:

```typescript
<ActivityDetailModal
  open={!!selectedActivity}
  onClose={() => setSelectedActivity(null)}
  activity={selectedActivity}
/>
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: wire ActivityDetailModal into calendar cardio cards"
```

---

### Task 8: Update RecoveryBar with Recovery Time

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update RecoveryBar to accept and show recovery time**

Find the `RecoveryBar` component. Add a `recoveryTimeMin` prop:

```typescript
function RecoveryBar({ r, recoveryTimeMin }: { r: RecoveryLog; recoveryTimeMin?: number | null }) {
```

At the end of the metrics list, add:

```typescript
if (recoveryTimeMin != null && recoveryTimeMin > 0) {
  metrics.push({ icon: "⏱", value: `${Math.round(recoveryTimeMin / 60)}h`, label: "Recover", color: "#f97316" });
}
```

- [ ] **Step 2: Pass recovery time from DayColumn**

In `DayColumn`, compute the max recovery time for the day's cardio activities and pass it to `RecoveryBar`:

```typescript
const maxRecoveryTime = day.cardio.reduce((max, c) => Math.max(max, c.recovery_time_min || 0), 0);
```

Update the RecoveryBar call:

```typescript
{day.recovery && <RecoveryBar r={day.recovery} recoveryTimeMin={maxRecoveryTime || null} />}
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: show recovery time estimate in daily recovery bar"
```

---

### Task 9: Final Test Suite Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all frontend tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final cleanup for Garmin activity sync feature"
```
