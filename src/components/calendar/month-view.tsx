"use client";

import { useMemo, useState } from "react";
import { WeekRow } from "./week-row";
import { WeekSummaryModal } from "./week-summary-modal";
import {
  DAY_NAMES, TYPE_COLORS,
  buildMonthWeeks, getMonday, weekNumberFor,
  type DayData,
} from "@/lib/training/calendar-data";
import type { ApiData, CardioLog, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import type { UnitPreferences } from "@/lib/units";

interface MonthViewProps {
  data: ApiData;
  units: UnitPreferences;
  onWorkoutClick?: (w: WorkoutLog) => void;
  onCardioClick?: (c: CardioLog) => void;
}

const navBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "6px 10px", cursor: "pointer",
  display: "flex", alignItems: "center", color: "#374151",
  transition: "background .15s",
};

const SIDEBAR_WIDTH = 110;

export function MonthView({ data, units, onWorkoutClick, onCardioClick }: MonthViewProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [summaryWeek, setSummaryWeek] = useState<{ days: DayData[]; weekNum: number } | null>(null);

  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const firstMonday = getMonday(firstOfMonth);
    const lastMonday = getMonday(lastOfMonth);
    // Number of Mondays from firstMonday through lastMonday (inclusive).
    // Counting Monday-to-Monday avoids over-counting weeks whose first day
    // is in the next month (e.g. a Jun 1–7 row in May).
    const weekCount = Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
    return buildMonthWeeks(firstMonday, weekCount, data);
  }, [data, monthDate]);

  const weekNumbers = useMemo(() => weeks.map((w) => weekNumberFor(w[0].dateObj)), [weeks]);

  const label = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 14px" }}>
        <button onClick={() => setMonthOffset((o) => o - 1)} style={navBtn} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button onClick={() => setMonthOffset((o) => o + 1)} style={navBtn} aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button onClick={() => setMonthOffset(0)} style={{ ...navBtn, padding: "6px 14px", fontSize: 11, fontWeight: 700 }}>Today</button>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginLeft: 10 }}>{label}</span>
      </div>

      <div style={{ display: "flex" }}>
        <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{
              textAlign: "center", fontSize: 10, fontWeight: 700,
              color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em",
              padding: "6px 0",
            }}>{d}</div>
          ))}
        </div>
      </div>

      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 27, 34, 0.03)",
      }}>
        {weeks.map((weekDays, wi) => (
          <WeekRow
            key={weekDays[0].date}
            days={weekDays}
            weekNum={weekNumbers[wi]}
            units={units}
            hrZoneBoundaries={data.hrZones?.boundaries ?? null}
            onWorkoutClick={onWorkoutClick}
            onCardioClick={onCardioClick}
            onSummaryClick={(days, weekNum) => setSummaryWeek({ days, weekNum })}
          />
        ))}
      </div>

      <WeekSummaryModal
        days={summaryWeek?.days ?? null}
        weekNum={summaryWeek?.weekNum ?? 0}
        units={units}
        onClose={() => setSummaryWeek(null)}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 14, fontSize: 11, color: "#6b7280" }}>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.bg, border: `1.5px solid ${c.border}`, display: "inline-block" }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
