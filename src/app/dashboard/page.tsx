"use client";

import { useEffect, useState, useCallback } from "react";
import { TodayCard } from "@/components/dashboard/today-card";
import { WeekStrip } from "@/components/plan/week-strip";
import { CaloriesCard } from "@/components/dashboard/calories-card";
import { WeightCard } from "@/components/dashboard/weight-card";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { SyncStatus } from "@/components/dashboard/sync-status";

interface DashboardData {
  today: {
    date: string;
    session_type: string | null;
    ai_notes: string | null;
  };
  weekWorkouts: Array<{
    id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    status: string;
    approved: boolean;
  }>;
  weekCompletions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }>;
  weekStart: string;
  nutrition: {
    calories: number;
    protein: number;
    target_calories: number;
  } | null;
  recovery: {
    hrv: number | null;
    sleep_hours: number | null;
    body_battery: number | null;
    readiness: "good" | "fair" | "low";
  } | null;
  weight: {
    current: number | null;
    direction: "up" | "down" | "stable";
  } | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dashboard");
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <SyncStatus />

      <TodayCard
        sessionType={data?.today.session_type ?? null}
        aiNotes={data?.today.ai_notes ?? null}
        recovery={data?.recovery ? {
          hrv: data.recovery.hrv,
          sleep_hours: data.recovery.sleep_hours,
          body_battery: data.recovery.body_battery,
        } : null}
      />

      {data?.weekWorkouts && data.weekWorkouts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-gray-500">This Week</h2>
          <WeekStrip
            workouts={data.weekWorkouts}
            completions={data.weekCompletions}
            weekStart={data.weekStart}
            today={today}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <CaloriesCard
          calories={data?.nutrition?.calories ?? null}
          target={data?.nutrition?.target_calories ?? 2000}
          protein={data?.nutrition?.protein ?? null}
        />
        <WeightCard
          current={data?.weight?.current ?? null}
          direction={data?.weight?.direction ?? "stable"}
        />
        <RecoveryCard
          hrv={data?.recovery?.hrv ?? null}
          sleepHours={data?.recovery?.sleep_hours ?? null}
          bodyBattery={data?.recovery?.body_battery ?? null}
          readiness={data?.recovery?.readiness ?? null}
        />
      </div>
    </div>
  );
}
