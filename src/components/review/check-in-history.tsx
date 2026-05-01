"use client";

import { useState } from "react";

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
  adjustments: Array<{ type: string; description: string; affected_days: number[] }> | null;
  user_approved: boolean | null;
  created_at: string;
}

function formatWeekRange(startDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function complianceColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

export function CheckInHistory({ history }: { history: CheckIn[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center">
        <p className="text-sm text-gray-400">No previous check-ins yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">History</h2>
      {history.map((ci) => {
        const isExpanded = expandedId === ci.id;
        return (
          <div key={ci.id} className="rounded-lg border bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : ci.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">{formatWeekRange(ci.week_start_date)}</span>
                <span className={`text-sm font-bold ${complianceColor(ci.compliance_pct)}`}>{ci.compliance_pct}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="max-w-xs truncate text-xs text-gray-400">{ci.ai_summary.slice(0, 80)}...</span>
                <span className="text-gray-400">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3 space-y-3">
                <p className="text-sm leading-relaxed text-gray-700">{ci.ai_summary}</p>
                <div className="flex gap-4 text-xs text-gray-500">
                  {ci.avg_calories !== null && <span>Cal: {ci.avg_calories}</span>}
                  {ci.avg_protein !== null && <span>Protein: {ci.avg_protein}g</span>}
                  {ci.avg_sleep_hours !== null && <span>Sleep: {ci.avg_sleep_hours}h</span>}
                  {ci.avg_hrv !== null && <span>HRV: {ci.avg_hrv}</span>}
                </div>
                {ci.risk_flags && ci.risk_flags.length > 0 && (
                  <div className="space-y-1">
                    {ci.risk_flags.map((flag, i) => (
                      <p key={i} className="text-xs text-red-600">⚠ {flag}</p>
                    ))}
                  </div>
                )}
                {ci.adjustments && ci.adjustments.length > 0 && (
                  <div className="space-y-1">
                    {ci.adjustments.map((adj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{adj.type}</span>
                        <span className="text-xs text-gray-600">{adj.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
