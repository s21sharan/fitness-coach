"use client";

import { useEffect, useState, useCallback } from "react";
import { PlanHeader } from "@/components/plan/plan-header";
import { WeekStrip } from "@/components/plan/week-strip";
import { AdjustmentBanner } from "@/components/plan/adjustment-banner";
import { AdjustmentReview } from "@/components/plan/adjustment-review";

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
      <div>
        <h1 className="text-2xl font-bold">My Plan</h1>
        <p className="mt-2 text-gray-500">
          Complete onboarding to generate your training plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlanHeader
        splitType={data.plan.split_type}
        bodyGoal={data.plan.body_goal}
        raceType={data.plan.race_type}
        planConfig={data.plan.plan_config}
        weekNumber={data.weekNumber}
        weekOffset={weekOffset}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        onToday={() => setWeekOffset(0)}
      />

      <WeekStrip
        workouts={data.workouts}
        completions={data.completions}
        weekStart={data.weekStart}
        today={today}
      />

      <div className="flex flex-wrap gap-4">
        {[
          { color: "bg-green-50 border-green-500", label: "Lifting (Hevy)" },
          { color: "bg-blue-50 border-blue-500", label: "Run (Strava)" },
          { color: "bg-indigo-50 border-indigo-500", label: "Swim (Strava)" },
          { color: "bg-amber-50 border-amber-500", label: "Key Session" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`inline-block h-2.5 w-2.5 rounded border ${color}`} />
            {label}
          </div>
        ))}
      </div>

      <AdjustmentBanner
        checkIn={checkIn}
        onReview={() => setReviewOpen(true)}
        onDismiss={() => setCheckIn(null)}
      />

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
