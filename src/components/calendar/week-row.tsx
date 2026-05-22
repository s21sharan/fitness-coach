"use client";

import { DayCell } from "./day-cell";
import {
  weekTotals, toDS, fmtSec,
  type DayData,
} from "@/lib/training/calendar-data";
import type { CardioLog, LinkedActual, UserHrZones, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import { fmtDist as fmtDistUnit, distanceLabel, type UnitPreferences } from "@/lib/units";
import type { TrainingBlock } from "@/lib/training/blocks";
import { computeBlockWeekNumber } from "@/lib/training/blocks";
import { blockTypeLabel } from "@/lib/training/phase-rules";

import type { PlannedClickPayload } from "./day-cell";

interface WeekRowProps {
  days: DayData[];
  weekNum: number;
  units: UnitPreferences;
  hrZones?: UserHrZones | null;
  linkedActuals?: Record<string, LinkedActual>;
  onWorkoutClick?: (w: WorkoutLog) => void;
  onCardioClick?: (c: CardioLog) => void;
  onPlannedClick?: (p: PlannedClickPayload) => void;
  onSummaryClick?: (days: DayData[], weekNum: number) => void;
  activeBlock?: TrainingBlock | null;
}

export function WeekRow({ days, weekNum, units, hrZones, linkedActuals, onWorkoutClick, onCardioClick, onPlannedClick, onSummaryClick, activeBlock }: WeekRowProps) {
  const todayStr = toDS(new Date());
  const isFutureWeek = days[0].date > todayStr;
  const hasData = !isFutureWeek;

  const t = hasData ? weekTotals(days) : null;
  const fmtDist = (km: number) => fmtDistUnit(km, units.distance);
  const distUnit = distanceLabel(units.distance);
  const clickable = !!onSummaryClick && !!t && t.timeSec > 0;

  // Determine whether this week falls within the active block's date range
  const weekMonday = days[0].date;
  const blockIndicator: string | null = (() => {
    if (!activeBlock) return null;
    if (weekMonday < activeBlock.start_date || weekMonday > activeBlock.end_date) return null;
    const weekNum = computeBlockWeekNumber(activeBlock.start_date, weekMonday);
    const label = blockTypeLabel(activeBlock.block_type);
    return `${label} · Wk ${weekNum}/${activeBlock.week_count}`;
  })();

  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
      <button
        type="button"
        onClick={clickable ? () => onSummaryClick!(days, weekNum) : undefined}
        disabled={!clickable}
        style={{
          width: 110, flexShrink: 0, padding: "10px 12px",
          borderTop: "none", borderBottom: "none", borderLeft: "none",
          borderRight: "1px solid #e5e7eb",
          background: "#fafafa",
          display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 4,
          textAlign: "left",
          font: "inherit",
          color: "inherit",
          cursor: clickable ? "pointer" : "default",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; }}
        onMouseLeave={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.background = "#fafafa"; }}
      >
        {blockIndicator && (
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>
            {blockIndicator}
          </div>
        )}
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
      </button>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, minWidth: 0 }}>
        {days.map((day, i) => (
          <div key={day.date} style={{ borderRight: i < 6 ? "1px solid #f3f4f6" : "none", padding: "0 2px" }}>
            <DayCell day={day} variant="compact" units={units} hrZones={hrZones} linkedActuals={linkedActuals} onWorkoutClick={onWorkoutClick} onCardioClick={onCardioClick} onPlannedClick={onPlannedClick} />
          </div>
        ))}
      </div>
    </div>
  );
}
