"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/topbar";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { TodayCard } from "@/components/dashboard/today-card";
import { WeekStripHome } from "@/components/dashboard/week-strip-home";
import { CaloriesCard } from "@/components/dashboard/calories-card";
import { WeightCard } from "@/components/dashboard/weight-card";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { CoachNudge } from "@/components/dashboard/coach-nudge";
import { PlanSummary } from "@/components/dashboard/plan-summary";

interface WeekWorkout {
  id: string;
  date: string;
  day_of_week?: string;
  session_type?: string | null;
  ai_notes?: string | null;
  status?: string;
  approved?: boolean;
}

interface DashboardData {
  today: {
    date: string;
    session_type: string | null;
    ai_notes: string | null;
  };
  weekWorkouts: WeekWorkout[];
  weekCompletions: Record<string, Record<string, unknown>>;
  weekStart: string;
  plan: {
    splitType: string;
    sessionsCompleted: number;
    sessionsTotal: number;
  } | null;
  nutrition: {
    calories: number;
    protein: number;
    target_calories: number;
  } | null;
  recovery: {
    hrv: number;
    sleep_hours: number;
    body_battery: number;
    readiness: "good" | "fair" | "low";
  } | null;
  weight: {
    current: number | null;
    direction: "up" | "down" | "stable";
  };
}

function formatTopbarDate(dateStr: string | null | undefined): string {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const subtitleDate = data?.today?.date
    ? formatTopbarDate(data.today.date)
    : formatTopbarDate(null);

  return (
    <>
      <Topbar title="Today" subtitle={subtitleDate} />
      <div className="main">
        <SyncStatus />
        <TodayCard
          sessionType={data?.today?.session_type}
          aiNotes={data?.today?.ai_notes}
          date={data?.today?.date}
          readiness={data?.recovery?.readiness}
          hrv={data?.recovery?.hrv}
        />
        <PlanSummary
          splitType={data?.plan?.splitType}
          sessionsCompleted={data?.plan?.sessionsCompleted}
          sessionsTotal={data?.plan?.sessionsTotal}
        />
        <div
          className="mt-4 md:mt-0"
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "var(--muted)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            margin: "0 0 10px",
          }}
        >
          This week
        </div>
        <WeekStripHome
          weekWorkouts={data?.weekWorkouts}
          weekCompletions={data?.weekCompletions}
          weekStart={data?.weekStart}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <CaloriesCard
            calories={data?.nutrition?.calories}
            protein={data?.nutrition?.protein}
            targetCalories={data?.nutrition?.target_calories}
          />
          <WeightCard
            weight={data?.weight?.current}
            direction={data?.weight?.direction}
          />
          <RecoveryCard
            hrv={data?.recovery?.hrv}
            sleepHours={data?.recovery?.sleep_hours}
            bodyBattery={data?.recovery?.body_battery}
            readiness={data?.recovery?.readiness}
          />
        </div>
        <CoachNudge />
      </div>
    </>
  );
}
