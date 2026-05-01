"use client";

import Link from "next/link";

interface TodayCardProps {
  sessionType: string | null;
  aiNotes: string | null;
  recovery: { hrv: number | null; sleep_hours: number | null; body_battery: number | null } | null;
}

export function TodayCard({ sessionType, aiNotes, recovery }: TodayCardProps) {
  const isRest = sessionType === "Rest";
  const hasSession = sessionType && !isRest;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-medium text-gray-500">Today</h2>
          {hasSession ? (
            <p className="mt-1 text-2xl font-bold">{sessionType}</p>
          ) : isRest ? (
            <p className="mt-1 text-2xl font-bold text-gray-400">Rest Day</p>
          ) : (
            <p className="mt-1 text-lg text-gray-400">No session planned</p>
          )}
          {aiNotes && (
            <p className="mt-1 text-sm text-blue-600 italic">{aiNotes}</p>
          )}
        </div>
        {recovery && (
          <div className="flex gap-2">
            {recovery.hrv !== null && (
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">HRV: {recovery.hrv}</span>
            )}
            {recovery.sleep_hours !== null && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{recovery.sleep_hours}h sleep</span>
            )}
            {recovery.body_battery !== null && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">BB {recovery.body_battery}</span>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <Link href="/dashboard/chat" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Chat with Coach
        </Link>
        <Link href="/dashboard/plan" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          View Plan
        </Link>
      </div>
    </div>
  );
}
