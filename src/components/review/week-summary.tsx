"use client";

import { StatCard } from "./stat-card";

interface Adjustment {
  type: string;
  description: string;
  affected_days: number[];
}

interface CheckIn {
  id: string;
  week_start_date: string;
  compliance_pct: number;
  avg_calories: number | null;
  avg_protein: number | null;
  avg_sleep_hours: number | null;
  avg_hrv: number | null;
  ai_summary: string;
  risk_flags: string[] | null;
  adjustments: Adjustment[] | null;
  user_approved: boolean | null;
}

function complianceColor(pct: number): "green" | "amber" | "red" {
  if (pct >= 80) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

function formatWeekRange(startDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function WeekSummary({ checkIn }: { checkIn: CheckIn | null }) {
  if (!checkIn) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-gray-500">Your first weekly review will appear after your first full week of training.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">This Week</h2>
        <span className="text-sm text-gray-500">{formatWeekRange(checkIn.week_start_date)}</span>
      </div>

      <div className="flex gap-3 rounded-lg border bg-white p-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
          <span className="text-sm font-bold text-white">C</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">{checkIn.ai_summary}</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Compliance" value={`${checkIn.compliance_pct}%`} color={complianceColor(checkIn.compliance_pct)} />
        <StatCard label="Avg Calories" value={checkIn.avg_calories !== null ? String(checkIn.avg_calories) : "—"} />
        <StatCard label="Avg Protein" value={checkIn.avg_protein !== null ? `${checkIn.avg_protein}g` : "—"} />
        <StatCard label="Avg Sleep" value={checkIn.avg_sleep_hours !== null ? `${checkIn.avg_sleep_hours}h` : "—"} />
        <StatCard label="Avg HRV" value={checkIn.avg_hrv !== null ? String(checkIn.avg_hrv) : "—"} />
      </div>

      {checkIn.risk_flags && checkIn.risk_flags.length > 0 && (
        <div className="space-y-1">
          {checkIn.risk_flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <span className="text-red-500">⚠</span>
              <p className="text-sm text-red-700">{flag}</p>
            </div>
          ))}
        </div>
      )}

      {checkIn.adjustments && checkIn.adjustments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Adjustments made:</p>
          {checkIn.adjustments.map((adj, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{adj.type}</span>
              <p className="text-sm text-gray-700">{adj.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
