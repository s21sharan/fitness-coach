"use client";

import { useEffect, useState, useCallback } from "react";
import { Topbar } from "@/components/topbar";
import { PlanNav } from "@/components/plan/plan-header";
import { WeekStrip, buildWeekDays } from "@/components/plan/week-strip";
import { AdjustmentBanner } from "@/components/plan/adjustment-banner";
import { AdjustmentReview } from "@/components/plan/adjustment-review";
import { Bars } from "@/components/app/bars";
import { Sparkline } from "@/components/app/sparkline";

interface PlanData {
  plan: {
    id: string;
    split_type: string;
    body_goal: string | null;
    race_type: string | null;
    plan_config: Record<string, unknown> | null;
    created_at: string;
  } | null;
  workouts: Array<{
    id: string;
    date: string;
    day_of_week: number;
    session_type: string;
    ai_notes: string | null;
    status: string;
    approved: boolean;
  }>;
  completions: Record<string, {
    workout?: { name: string; duration_minutes: number; exercise_count: number };
    cardio?: Array<{ type: string; distance: number; duration: number; avg_hr: number | null; pace_or_speed: number | null }>;
  }>;
  recovery: { hrv: number | null; sleep_hours: number | null; resting_hr: number | null } | null;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
}

interface CheckIn {
  id: string;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Array<{ type: string; description: string; affected_days: number[] }> | null;
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) => {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `Week of ${fmt(weekStart)} — ${fmt(weekEnd)}`;
}

export default function PlanPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<PlanData | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/plan?weekOffset=${weekOffset}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, [weekOffset]);

  const fetchCheckIn = useCallback(async () => {
    const res = await fetch("/api/plan/check-in");
    if (res.ok) {
      const json = await res.json();
      setCheckIn(json.checkIn);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
    fetchCheckIn();
  }, [fetchPlan, fetchCheckIn]);

  const handleApprove = async (checkInId: string) => {
    await fetch("/api/plan/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId, approved: true }),
    });
    setCheckIn(null);
    fetchPlan();
  };

  const handleReject = async (checkInId: string) => {
    await fetch("/api/plan/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId, approved: false }),
    });
    setCheckIn(null);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  if (!data?.plan) {
    return (
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar title="My Plan" subtitle="No plan yet" />
        <div className="main">
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 24 }}>
            Complete onboarding to generate your training plan.
          </p>
        </div>
      </div>
    );
  }

  const weekLabel =
    data.weekStart && data.weekEnd
      ? formatWeekLabel(data.weekStart, data.weekEnd)
      : `Week ${data.weekNumber}`;

  const days = buildWeekDays(data.workouts, data.completions, data.weekStart, today);

  return (
    <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        title="My Plan"
        subtitle={weekLabel}
        right={
          <PlanNav
            weekOffset={weekOffset}
            onPrev={() => setWeekOffset((o) => o - 1)}
            onNext={() => setWeekOffset((o) => o + 1)}
            onToday={() => setWeekOffset(0)}
          />
        }
      />

      <div className="main">
        {/* Adjustment banner */}
        <AdjustmentBanner
          checkIn={checkIn}
          visible={!!checkIn}
          onApprove={(id) => {
            setReviewOpen(true);
            void id;
          }}
          onReject={handleReject}
          onReview={() => setReviewOpen(true)}
          onDismiss={() => setCheckIn(null)}
        />

        {/* 7-column week strip */}
        <WeekStrip days={days} />

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="card">
            <div className="eyebrow">Weekly volume by muscle group</div>
            <h3 style={{ margin: "4px 0 12px", fontSize: 18, fontWeight: 800 }}>Balanced split</h3>
            <Bars
              width={420}
              height={120}
              data={[
                { l: "Chest", v: 14, active: true },
                { l: "Back", v: 16 },
                { l: "Shldr", v: 10 },
                { l: "Arms", v: 12 },
                { l: "Legs", v: 18 },
                { l: "Core", v: 8 },
              ]}
            />
          </div>
          <div className="card">
            <div className="eyebrow">Cardio load · 6 weeks</div>
            <h3 style={{ margin: "4px 0 12px", fontSize: 18, fontWeight: 800 }}>Building base</h3>
            <Sparkline
              points={[18, 22, 25, 28, 32, 38]}
              width={420}
              height={100}
              color="var(--sky-deep)"
            />
          </div>
        </div>
      </div>

      {/* Adjustment review modal */}
      {checkIn && (
        <AdjustmentReview
          checkInId={checkIn.id}
          summary={checkIn.ai_summary}
          adjustments={checkIn.adjustments || []}
          riskFlags={checkIn.risk_flags || []}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
