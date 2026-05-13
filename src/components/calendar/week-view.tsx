"use client";

import { useMemo, useState } from "react";
import { DayCell } from "./day-cell";
import { MuscleDiagram } from "./muscle-diagram";
import { computeMuscleVolume } from "@/lib/exercise-muscles";
import {
  TYPE_COLORS,
  buildWeek, weekTotals, computeFitnessCurve, getMonday, addDays, toDS,
  weekNumberFor, fmtSec,
} from "@/lib/training/calendar-data";
import type { ApiData, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import { fmtDist as fmtDistUnit, distanceLabel, type UnitPreferences } from "@/lib/units";

interface WeekViewProps {
  data: ApiData;
  units: UnitPreferences;
  onWorkoutClick?: (w: WorkoutLog) => void;
}

const navBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
  padding: "6px 10px", cursor: "pointer",
  display: "flex", alignItems: "center", color: "#374151",
};

export function WeekView({ data, units, onWorkoutClick }: WeekViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const monday = useMemo(() => addDays(getMonday(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(() => buildWeek(monday, data), [monday, data]);
  const totals = useMemo(() => weekTotals(days), [days]);
  const fitnessCurve = useMemo(() => computeFitnessCurve(data, 90), [data]);
  const weekNum = useMemo(() => weekNumberFor(monday), [monday]);

  const sunday = addDays(monday, 6);
  const todayStr = toDS(new Date());
  const isFutureWeek = days[0].date > todayStr;
  const isCurrentWeek = days[0].date <= todayStr && days[6].date >= todayStr;
  const refDate = isCurrentWeek ? todayStr : days[6].date;
  const weekPoint = fitnessCurve.find((p) => p.date === refDate) || [...fitnessCurve].reverse().find((p) => p.date <= refDate);
  const ctl = weekPoint?.ctl ?? 0;
  const atl = weekPoint?.atl ?? 0;
  const tsb = weekPoint?.tsb ?? 0;

  const fmtDist = (km: number) => fmtDistUnit(km, units.distance);
  const distUnit = distanceLabel(units.distance);

  const rangeLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const typeKeys = Object.keys(totals.byType).sort();
  const hasActivity = totals.timeSec > 0;

  const allExercises = days.flatMap((d) =>
    d.workouts.flatMap((w) => (Array.isArray(w.exercises) ? w.exercises : []) as Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }>)
  );
  const muscleData = allExercises.length > 0 ? computeMuscleVolume(allExercises) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 14px", flexWrap: "wrap" }}>
        <button onClick={() => setWeekOffset((o) => o - 1)} style={navBtn} aria-label="Previous week">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button onClick={() => setWeekOffset((o) => o + 1)} style={navBtn} aria-label="Next week">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button onClick={() => setWeekOffset(0)} style={{ ...navBtn, padding: "6px 14px", fontSize: 11, fontWeight: 700 }}>This week</button>
        <div style={{ marginLeft: 10, display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Week {weekNum}</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>{rangeLabel}</span>
        </div>

        {hasActivity && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 18, alignItems: "center", fontSize: 11 }}>
            <Stat label="Time" value={fmtSec(totals.timeSec)} />
            <Stat label="Load" value={`${totals.load}`} />
            {totals.distKm > 0 && <Stat label="Distance" value={`${fmtDist(totals.distKm)} ${distUnit}`} />}
            <Stat label="Fitness" value={`${ctl}`} color="#3b82f6" />
            <Stat label="Fatigue" value={`${atl}`} color="#f97316" />
            <Stat label="Form" value={`${tsb}`} color={tsb >= 0 ? "#22c55e" : "#ef4444"} />
          </div>
        )}
      </div>

      <div style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
        boxShadow: "0 1px 2px rgba(15, 27, 34, 0.03)",
        padding: 8, overflow: "auto",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
          {days.map((day) => (
            <div key={day.date} style={{
              background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 10,
              minWidth: 150,
            }}>
              <DayCell day={day} variant="tall" units={units} onWorkoutClick={onWorkoutClick} />
            </div>
          ))}
        </div>
      </div>

      {hasActivity && (typeKeys.length > 0 || muscleData) && (
        <div style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: muscleData ? "2fr 1fr" : "1fr",
          gap: 14,
        }}>
          {typeKeys.length > 0 && (
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: 14,
              boxShadow: "0 1px 2px rgba(15, 27, 34, 0.03)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", marginBottom: 8 }}>By type</div>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <td style={{ padding: "4px 0" }}>Activity</td>
                    <td style={{ textAlign: "right" }}>Time</td>
                    <td style={{ textAlign: "right" }}>Distance</td>
                    <td style={{ textAlign: "right" }}>Load</td>
                    <td style={{ textAlign: "right" }}>Sessions</td>
                  </tr>
                </thead>
                <tbody>
                  {typeKeys.map((k) => {
                    const bt = totals.byType[k];
                    const c = TYPE_COLORS[k];
                    return (
                      <tr key={k} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ color: c?.text || "#374151", fontWeight: 700, padding: "6px 0" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c?.border || "#999", marginRight: 6 }} />
                          {c?.label || k}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtSec(bt.timeSec)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.distKm > 0 ? `${fmtDist(bt.distKm)} ${distUnit}` : "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{bt.load}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {muscleData && (
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: 14,
              boxShadow: "0 1px 2px rgba(15, 27, 34, 0.03)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Muscle focus</div>
              <MuscleDiagram muscleData={muscleData} />
            </div>
          )}
        </div>
      )}

      {!hasActivity && (
        <div style={{
          marginTop: 14, padding: 24, textAlign: "center",
          background: "#fff", border: "1px dashed #e5e7eb", borderRadius: 12,
          color: "#9ca3af", fontSize: 12,
        }}>
          {isFutureWeek ? "Future week — no activity yet." : "No activity logged this week."}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: color || "#111827" }}>{value}</span>
    </div>
  );
}
