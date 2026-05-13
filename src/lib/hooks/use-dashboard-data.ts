"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCalendarDateLocal } from "@/lib/dates/local-calendar";
import { getUnitPreferences, type UnitPreferences } from "@/lib/units";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";
import type { Integration } from "@/components/app/connection-bar";

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
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
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

export interface ApiData {
  integrations: Integration[];
  nutrition: unknown[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog[];
  planned: PlannedWorkout[];
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const localToday = encodeURIComponent(formatCalendarDateLocal(new Date()));
    const res = await fetch(`/api/test-data?localToday=${localToday}`);
    if (res.ok) {
      const json = await res.json();
      setData({
        ...json,
        planned: Array.isArray(json.planned) ? json.planned : [],
      } as ApiData);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerSync = useCallback(async (provider: string) => {
    setSyncing(provider);
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
    setTimeout(() => { fetchData(); setSyncing(null); }, 3000);
  }, [fetchData]);

  const triggerFixDates = useCallback(async () => {
    if (fixingDates) return;
    setFixingDates(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/integrations/fix-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok && res.status !== 207) {
        const text = await res.text().catch(() => "");
        console.error("fix-dates failed:", res.status, text);
      }
    } catch (err) {
      console.error("fix-dates error:", err);
    }
    setTimeout(() => { fetchData(); setFixingDates(false); }, 8000);
  }, [fixingDates, fetchData]);

  return { data, loading, syncing, fixingDates, units, refetch: fetchData, triggerSync, triggerFixDates };
}
