"use client";

import { Topbar } from "@/components/topbar";
import { SyncStatus } from "@/components/dashboard/sync-status";
import { TodayCard } from "@/components/dashboard/today-card";
import { WeekStripHome } from "@/components/dashboard/week-strip-home";
import { CaloriesCard } from "@/components/dashboard/calories-card";
import { WeightCard } from "@/components/dashboard/weight-card";
import { RecoveryCard } from "@/components/dashboard/recovery-card";
import { CoachNudge } from "@/components/dashboard/coach-nudge";

export default function DashboardPage() {
  return (
    <>
      <Topbar title="Today" subtitle="Friday · May 1, 2026" />
      <div className="main">
        <SyncStatus />
        <TodayCard />
        <div
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
        <WeekStripHome />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <CaloriesCard />
          <WeightCard />
          <RecoveryCard />
        </div>
        <CoachNudge />
      </div>
    </>
  );
}
