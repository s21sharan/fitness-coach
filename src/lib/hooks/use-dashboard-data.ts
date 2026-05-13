"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCalendarDateLocal } from "@/lib/dates/local-calendar";
import { getUnitPreferences, type UnitPreferences } from "@/lib/units";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";
import type { Integration } from "@/components/app/connection-bar";
import type { TrainingBlock } from "@/lib/training/blocks";

export interface WorkoutLog {
  date: string;
  workout_id: string;
  name: string;
  duration_minutes: number;
  exercises: Array<{
    name: string;
    sets: Array<{ index: number; type: string; weight_kg: number; reps: number; rpe: number | null }>;
  }> | unknown;
}

export interface CardioLog {
  date: string;
  activity_id: string;
  type: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  max_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
  start_time: string | null;
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

export interface RecoveryLog {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  body_battery: number | null;
  stress_level: number | null;
  steps: number | null;
}

export interface PlannedWorkout {
  id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: {
    contract?: WorkoutContractV1 | null;
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
  approved: boolean;
  status: string;
}

export interface ZoneBoundary {
  zone: number;
  low: number;
  high: number;
}

export interface UserHrZones {
  source: "garmin" | "legacy";
  boundaries: ZoneBoundary[];
  syncedAt: string | null;
}

export interface ApiData {
  integrations: Integration[];
  nutrition: unknown[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog[];
  planned: PlannedWorkout[];
  hrZones: UserHrZones | null;
  activeBlock: TrainingBlock | null;
}

export interface UseDashboardData {
  data: ApiData | null;
  loading: boolean;
  syncing: string | null;
  fixingDates: boolean;
  units: UnitPreferences;
  refetch: () => Promise<void>;
  triggerSync: (provider: string) => Promise<void>;
  triggerFixDates: () => Promise<void>;
}

export function useDashboardData(): UseDashboardData {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [fixingDates, setFixingDates] = useState(false);
  const [units, setUnits] = useState<UnitPreferences>({ distance: "mi", weight: "lbs" });

  useEffect(() => {
    setUnits(getUnitPreferences());
  }, []);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const localToday = encodeURIComponent(formatCalendarDateLocal(new Date()));
    const res = await fetch(`/api/test-data?localToday=${localToday}`);
    if (res.ok) {
      const json = await res.json();
      setData({
        ...json,
        planned: Array.isArray(json.planned) ? json.planned : [],
        hrZones: json.hrZones ?? null,
        activeBlock: json.activeBlock ?? null,
      } as ApiData);
    }
    if (!opts?.silent) setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerSync = useCallback(async (provider: string) => {
    setSyncing(provider);
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
    setTimeout(() => { fetchData(); setSyncing(null); }, 3000);
  }, [fetchData]);

  const triggerFixDates = useCallback(async () => {
    if (fixingDates) return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "This will DELETE all your completed Hevy workouts and Strava cardio logs, then re-sync them from scratch with your local timezone. Continue?",
      );
      if (!confirmed) return;
    }
    setFixingDates(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/integrations/fix-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      const payload = await res.json().catch(() => null);
      if (res.status === 207 || !res.ok) {
        console.error("fix-dates response:", res.status, payload);
      } else {
        console.log("fix-dates response:", res.status, payload);
      }
    } catch (err) {
      console.error("fix-dates error:", err);
    }
    // Strava backfill makes 1 API call per activity (getActivity), so a full
    // re-sync can take 30–90s. Refetch every 5s for up to 2 minutes so the
    // user sees rows trickle in as the backend completes the sync.
    const start = Date.now();
    const MAX_MS = 120_000;
    const POLL_MS = 5_000;
    const poll = async () => {
      await fetchData({ silent: true });
      if (Date.now() - start >= MAX_MS) {
        setFixingDates(false);
        return;
      }
      setTimeout(poll, POLL_MS);
    };
    setTimeout(poll, POLL_MS);
  }, [fixingDates, fetchData]);

  return { data, loading, syncing, fixingDates, units, refetch: fetchData, triggerSync, triggerFixDates };
}
