"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectionBar } from "@/components/app/connection-bar";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { WorkoutModal } from "@/components/calendar/workout-modal";
import { useDashboardData, type WorkoutLog } from "@/lib/hooks/use-dashboard-data";

type CalendarView = "month" | "week";

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: CalendarView = searchParams.get("view") === "week" ? "week" : "month";

  const { data, loading, syncing, fixingDates, units, triggerSync, triggerFixDates } = useDashboardData();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);

  const setView = (next: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "month") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }
  if (!data) return <p style={{ padding: 32, color: "#6b7280" }}>Failed to load data.</p>;

  return (
    <div style={{ padding: "16px 20px 40px", maxWidth: 1600, margin: "0 auto" }}>
      <ConnectionBar
        integrations={data.integrations}
        syncing={syncing}
        onSync={triggerSync}
        fixingDates={fixingDates}
        onFixDates={triggerFixDates}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "month" ? (
        <MonthView data={data} units={units} onWorkoutClick={setSelectedWorkout} />
      ) : (
        <WeekView data={data} units={units} onWorkoutClick={setSelectedWorkout} />
      )}

      {selectedWorkout && (
        <WorkoutModal workout={selectedWorkout} open={true} onClose={() => setSelectedWorkout(null)} />
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const baseStyle: React.CSSProperties = {
    border: "none", background: "transparent",
    padding: "6px 14px", fontSize: 12, fontWeight: 700,
    cursor: "pointer", borderRadius: 7,
    color: "#6b7280", transition: "background .15s, color .15s",
  };
  const activeStyle: React.CSSProperties = { background: "#fff", color: "#111827", boxShadow: "0 1px 2px rgba(15, 27, 34, 0.08)" };
  return (
    <div style={{
      display: "inline-flex", gap: 2, padding: 3,
      background: "#f3f4f6", borderRadius: 9,
      border: "1px solid #e5e7eb",
    }}>
      <button style={{ ...baseStyle, ...(view === "month" ? activeStyle : {}) }} onClick={() => onChange("month")}>Month</button>
      <button style={{ ...baseStyle, ...(view === "week" ? activeStyle : {}) }} onClick={() => onChange("week")}>Week</button>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  );
}
