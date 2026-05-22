"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectionBar } from "@/components/app/connection-bar";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { WorkoutModal } from "@/components/calendar/workout-modal";
import { CardioModal } from "@/components/calendar/cardio-modal";
import { PlannedWorkoutModal, type PlannedWorkoutModalData } from "@/components/calendar/planned-workout-modal";
import { ManualWorkoutModal } from "@/components/calendar/manual-workout-modal";
import { useDashboardData, type CardioLog, type WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import type { PlannedClickPayload } from "@/components/calendar/day-cell";
import { DailySummaryCard } from "@/components/dashboard/daily-summary-card";
import { BlockBanner } from "@/components/calendar/block-banner";

type CalendarView = "month" | "week";

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: CalendarView = searchParams.get("view") === "week" ? "week" : "month";

  const { data, loading, syncing, fixingDates, units, refetch, triggerSync, triggerFixDates } = useDashboardData();
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [selectedCardio, setSelectedCardio] = useState<CardioLog | null>(null);
  const [selectedPlanned, setSelectedPlanned] = useState<PlannedWorkoutModalData | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const handlePlannedClick = useCallback((p: PlannedClickPayload) => {
    setSelectedPlanned({
      plannedId: p.plannedId,
      date: p.date,
      sessionType: p.sessionType,
      aiNotes: p.aiNotes,
      slot: p.slot,
      status: p.status,
      skipReason: p.skipReason,
      completionNote: p.completionNote,
      linkedActual: p.linkedActual,
      targets: p.targets,
    });
  }, []);

  const handleSkip = useCallback(async (plannedId: string, reason: string) => {
    const res = await fetch("/api/plan/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedId, reason: reason || null }),
    });
    if (!res.ok) {
      console.error("skip failed", await res.text().catch(() => ""));
      return;
    }
    await refetch();
  }, [refetch]);

  const handleUnmatch = useCallback(async (plannedId: string) => {
    const res = await fetch("/api/plan/unmatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedId }),
    });
    if (!res.ok) {
      console.error("unmatch failed", await res.text().catch(() => ""));
      return;
    }
    await refetch();
  }, [refetch]);

  const handleSaveNote = useCallback(async (plannedId: string, note: string, markComplete: boolean) => {
    const res = await fetch("/api/plan/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedId, note, markComplete }),
    });
    if (!res.ok) {
      console.error("save note failed", await res.text().catch(() => ""));
      return;
    }
    await refetch();
  }, [refetch]);

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

      <DailySummaryCard />

      {data.activeBlock && (() => {
        const daysUntilEnd = Math.ceil(
          (new Date(data.activeBlock.end_date + "T00:00:00").getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );
        return daysUntilEnd <= 3 && daysUntilEnd >= 0 ? (
          <BlockBanner
            blockType={data.activeBlock.block_type}
            endDate={data.activeBlock.end_date}
            daysUntilEnd={daysUntilEnd}
          />
        ) : null;
      })()}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
        <LogSessionButton onClick={() => setShowManualModal(true)} />
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "month" ? (
        <MonthView data={data} units={units} onWorkoutClick={setSelectedWorkout} onCardioClick={setSelectedCardio} onPlannedClick={handlePlannedClick} />
      ) : (
        <WeekView data={data} units={units} onWorkoutClick={setSelectedWorkout} onCardioClick={setSelectedCardio} onPlannedClick={handlePlannedClick} />
      )}

      {selectedWorkout && (
        <WorkoutModal workout={selectedWorkout} open={true} onClose={() => setSelectedWorkout(null)} />
      )}
      {selectedCardio && (
        <CardioModal
          cardio={selectedCardio}
          allCardio={data.cardio}
          units={units}
          hrZones={data.hrZones ?? null}
          open={true}
          onClose={() => setSelectedCardio(null)}
        />
      )}
      {selectedPlanned && (
        <PlannedWorkoutModal
          data={selectedPlanned}
          open={true}
          onClose={() => setSelectedPlanned(null)}
          onSkip={handleSkip}
          onUnmatch={handleUnmatch}
          onSaveNote={handleSaveNote}
        />
      )}
      <ManualWorkoutModal
        open={showManualModal}
        onClose={() => setShowManualModal(false)}
        onCreated={() => { void refetch(); }}
      />
    </div>
  );
}

function LogSessionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "#0f172a", color: "#fff",
        border: "none", borderRadius: 8,
        padding: "7px 12px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", letterSpacing: "0.01em",
        boxShadow: "0 1px 2px rgba(15, 27, 34, 0.08)",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span>Plan session</span>
    </button>
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
