"use client";

interface RecoveryCardProps {
  hrv: number | null;
  sleepHours: number | null;
  bodyBattery: number | null;
  readiness: "good" | "fair" | "low" | null;
}

const READINESS_CONFIG: Record<string, { label: string; color: string; bgColor: string; pct: number }> = {
  good: { label: "Good", color: "text-green-600", bgColor: "bg-green-500", pct: 90 },
  fair: { label: "Fair", color: "text-amber-600", bgColor: "bg-amber-500", pct: 55 },
  low: { label: "Low", color: "text-red-600", bgColor: "bg-red-500", pct: 25 },
};

export function RecoveryCard({ hrv, sleepHours, bodyBattery, readiness }: RecoveryCardProps) {
  if (!readiness) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
        <p className="mt-2 text-sm text-gray-400">No data today</p>
      </div>
    );
  }

  const config = READINESS_CONFIG[readiness];

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-sm font-medium text-gray-500">Recovery</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${config.color}`}>{config.label}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${config.bgColor}`} style={{ width: `${config.pct}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-xs text-gray-500">
        {hrv !== null && <span>HRV {hrv}</span>}
        {sleepHours !== null && <span>{sleepHours}h sleep</span>}
        {bodyBattery !== null && <span>BB {bodyBattery}</span>}
      </div>
    </div>
  );
}
