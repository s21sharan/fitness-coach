"use client";

import { DayCell } from "./day-cell";
import {
  weekTotals, toDS, fmtSec,
  type DayData,
} from "@/lib/training/calendar-data";
import type { WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import { fmtDist as fmtDistUnit, distanceLabel, type UnitPreferences } from "@/lib/units";

interface WeekRowProps {
  days: DayData[];
  weekNum: number;
  units: UnitPreferences;
  onWorkoutClick?: (w: WorkoutLog) => void;
}

export function WeekRow({ days, weekNum, units, onWorkoutClick }: WeekRowProps) {
  const todayStr = toDS(new Date());
  const isFutureWeek = days[0].date > todayStr;
  const hasData = !isFutureWeek;

  const t = hasData ? weekTotals(days) : null;
  const fmtDist = (km: number) => fmtDistUnit(km, units.distance);
  const distUnit = distanceLabel(units.distance);

  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
      <div style={{
        width: 110, flexShrink: 0, padding: "10px 12px",
        borderRight: "1px solid #e5e7eb",
        background: "#fafafa",
        display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 4,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Week {weekNum}
        </div>
        {t && t.timeSec > 0 ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {fmtSec(t.timeSec)}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
              Load <b style={{ color: "#111827" }}>{t.load}</b>
            </div>
            {t.distKm > 0 && (
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
                {fmtDist(t.distKm)} {distUnit}
              </div>
            )}
          </>
        ) : isFutureWeek ? (
          <div style={{ color: "#d1d5db", fontSize: 11 }}>—</div>
        ) : (
          <div style={{ color: "#9ca3af", fontSize: 11 }}>No activity</div>
        )}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, minWidth: 0 }}>
        {days.map((day, i) => (
          <div key={day.date} style={{ borderRight: i < 6 ? "1px solid #f3f4f6" : "none", padding: "0 2px" }}>
            <DayCell day={day} variant="compact" units={units} onWorkoutClick={onWorkoutClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
