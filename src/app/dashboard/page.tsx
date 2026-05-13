"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FitnessChart, type FitnessPoint } from "@/components/charts/fitness-chart";
import { RecoveryTrendChart, HrZoneChart, TrainingLoadChart, computeHrZones, type RecoveryPoint, type LoadPoint } from "@/components/charts/recovery-charts";
import { ChartModal } from "@/components/charts/chart-modal";
import { getUnitPreferences, fmtDist as fmtDistUnit, fmtPace as fmtPaceUnit, distanceLabel, type UnitPreferences } from "@/lib/units";
import { PlannedCard, splitAmPmSessions } from "@/components/calendar/planned-card";
import { ComplianceBadge, getComplianceStatus } from "@/components/calendar/compliance-badge";
import { WorkoutModal } from "@/components/calendar/workout-modal";
import { MuscleDiagram } from "@/components/calendar/muscle-diagram";
import { computeMuscleVolume } from "@/lib/exercise-muscles";
import { formatCalendarDateLocal } from "@/lib/dates/local-calendar";
import type { WorkoutContractV1 } from "@/lib/training/workout-contract";
import { ActivityDetailModal } from "@/components/charts/activity-detail-modal";

/* ═══════════════════════════════════════════════
   DATA INTERFACES
   ═══════════════════════════════════════════════ */

interface Integration {
  provider: string;
  status: string;
  last_synced_at: string | null;
}

interface WorkoutLog {
  date: string;
  workout_id: string;
  name: string;
  duration_minutes: number;
  exercises: Array<{
    name: string;
    sets: Array<{ index: number; type: string; weight_kg: number; reps: number; rpe: number | null }>;
  }> | unknown;
}

interface CardioLog {
  date: string;
  activity_id: string;
  type: string;
  distance: number;
  duration: number;
  avg_hr: number | null;
  pace_or_speed: number | null;
  calories: number | null;
  elevation: number | null;
  start_time: string | null;
  max_hr: number | null;
  training_effect_aerobic: number | null;
  training_effect_anaerobic: number | null;
  vo2_max: number | null;
  recovery_time_min: number | null;
  avg_respiration: number | null;
  avg_cadence: number | null;
  avg_stride_length: number | null;
  ground_contact_time: number | null;
  hr_zones: Array<{ zone: number; low: number; high: number; minutes: number }> | null;
  splits: Array<{ km: number; distance_m: number | null; pace_min_km: number | null; avg_hr: number | null; elevation: number | null; cadence: number | null }> | null;
  source: string | null;
}

interface RecoveryLog {
  date: string;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  body_battery: number | null;
  stress_level: number | null;
  steps: number | null;
}

interface PlannedWorkout {
  id: string;
  date: string;
  day_of_week: number;
  session_type: string;
  ai_notes: string | null;
  targets: {
    contract?: WorkoutContractV1 | null;
    target_distance_km?: number | null;
    target_duration_min?: number | null;
    target_pace_min_km?: number | null;
    target_hr_zone?: number | null;
    target_hr_max?: number | null;
    muscle_focus?: string | null;
  } | null;
  approved: boolean;
  status: string;
}

interface ApiData {
  integrations: Integration[];
  nutrition: unknown[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog[];
  planned: PlannedWorkout[];
}

/* ═══════════════════════════════════════════════
   COLORS & CONFIG
   ═══════════════════════════════════════════════ */

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  lift:  { bg: "#fef9c3", border: "#eab308", text: "#854d0e", icon: "🏋️", label: "Strength" },
  run:   { bg: "#dcfce7", border: "#22c55e", text: "#166534", icon: "🏃", label: "Running" },
  bike:  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", icon: "🚴", label: "Cycling" },
  swim:  { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3", icon: "🏊", label: "Swimming" },
  other: { bg: "#f3e8ff", border: "#8b5cf6", text: "#5b21b6", icon: "⚡", label: "Other" },
};

const ZONE_COLORS = ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"];

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toDS(d: Date): string { return formatCalendarDateLocal(d); }
function fmtSec(s: number): string { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") + "m" : ""}` : `${m}m`; }
function fmtMin(m: number): string { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h${mm > 0 ? String(mm).padStart(2, "0") + "m" : ""}` : `${m}m`; }
// Unit-aware formatters — updated by component state
let _units: UnitPreferences = { distance: "mi", weight: "lbs" };
function fmtPace(p: number): string { return fmtPaceUnit(p, _units.distance); }
function fmtDist(km: number): string { return fmtDistUnit(km, _units.distance); }
function distUnit(): string { return distanceLabel(_units.distance); }
function cType(t: string): string { return t === "run" ? "run" : t === "bike" ? "bike" : t === "swim" ? "swim" : "other"; }

function estimateLoad(avgHr: number | null, durationSec: number): number {
  if (!avgHr || durationSec <= 0) return 0;
  const dMin = durationSec / 60;
  const hrFraction = avgHr / 180;
  return Math.round(dMin * hrFraction * hrFraction * 1.5);
}

function hrZone(avgHr: number | null): number {
  if (!avgHr) return 0;
  if (avgHr < 120) return 1;
  if (avgHr < 140) return 2;
  if (avgHr < 155) return 3;
  if (avgHr < 170) return 4;
  return 5;
}

function exerciseSummary(exercises: unknown): { totalSets: number; topExercises: string[]; avgRpe: number | null } {
  if (!Array.isArray(exercises)) return { totalSets: 0, topExercises: [], avgRpe: null };
  let totalSets = 0;
  const rpes: number[] = [];
  const names: string[] = [];
  for (const ex of exercises) {
    if (ex && typeof ex === "object" && "sets" in ex && Array.isArray(ex.sets)) {
      totalSets += ex.sets.length;
      for (const s of ex.sets) {
        if (s && typeof s === "object" && "rpe" in s && s.rpe != null) rpes.push(s.rpe as number);
      }
    }
    if (ex && typeof ex === "object" && "name" in ex) names.push(String(ex.name));
  }
  return {
    totalSets,
    topExercises: names.slice(0, 3),
    avgRpe: rpes.length > 0 ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length * 10) / 10 : null,
  };
}

/* ═══════════════════════════════════════════════
   DAY DATA & WEEK BUILDERS
   ═══════════════════════════════════════════════ */

interface DayData { date: string; dateObj: Date; workouts: WorkoutLog[]; cardio: CardioLog[]; recovery: RecoveryLog | null; planned: PlannedWorkout | null; }

function buildMonthWeeks(firstMonday: Date, weekCount: number, data: ApiData): DayData[][] {
  const plannedForRange = data.planned ?? [];
  const weeks: DayData[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekMonday = addDays(firstMonday, w * 7);
    const days: DayData[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekMonday, d);
      const ds = toDS(date);
      days.push({
        date: ds,
        dateObj: date,
        workouts: data.workouts.filter((x) => x.date === ds),
        cardio: data.cardio.filter((x) => x.date === ds),
        recovery: data.recovery.find((x) => x.date === ds) || null,
        planned: plannedForRange.find((p) => p.date === ds) || null,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

interface WeekTotals { timeSec: number; distKm: number; kcal: number; load: number; elevation: number; workouts: number; cardioSessions: number; byType: Record<string, { timeSec: number; distKm: number; load: number; count: number }>; }

function weekTotals(days: DayData[]): WeekTotals {
  const t: WeekTotals = { timeSec: 0, distKm: 0, kcal: 0, load: 0, elevation: 0, workouts: 0, cardioSessions: 0, byType: {} };
  for (const day of days) {
    for (const w of day.workouts) {
      const sec = (w.duration_minutes || 0) * 60; t.timeSec += sec; t.workouts++;
      const load = Math.round(sec / 60 * 0.8); t.load += load;
      if (!t.byType.lift) t.byType.lift = { timeSec: 0, distKm: 0, load: 0, count: 0 };
      t.byType.lift.timeSec += sec; t.byType.lift.load += load; t.byType.lift.count++;
    }
    for (const c of day.cardio) {
      t.timeSec += c.duration || 0; t.distKm += c.distance || 0;
      if (c.calories) t.kcal += c.calories;
      if (c.elevation) t.elevation += c.elevation;
      const load = estimateLoad(c.avg_hr, c.duration); t.load += load; t.cardioSessions++;
      const k = cType(c.type);
      if (!t.byType[k]) t.byType[k] = { timeSec: 0, distKm: 0, load: 0, count: 0 };
      t.byType[k].timeSec += c.duration || 0; t.byType[k].distKm += c.distance || 0; t.byType[k].load += load; t.byType[k].count++;
    }
  }
  t.distKm = Math.round(t.distKm * 100) / 100; t.kcal = Math.round(t.kcal); t.elevation = Math.round(t.elevation);
  return t;
}

function computeFitnessCurve(data: ApiData, numDays: number): FitnessPoint[] {
  const today = new Date();
  const points: FitnessPoint[] = [];
  let ctl = 0, atl = 0;
  for (let i = numDays - 1; i >= 0; i--) {
    const d = addDays(today, -i); const ds = toDS(d);
    let dayLoad = 0;
    for (const c of data.cardio.filter((x) => x.date === ds)) dayLoad += estimateLoad(c.avg_hr, c.duration);
    for (const w of data.workouts.filter((x) => x.date === ds)) dayLoad += Math.round((w.duration_minutes || 0) * 0.8);
    ctl = ctl + (dayLoad - ctl) / 42; atl = atl + (dayLoad - atl) / 7;
    points.push({ date: ds, load: dayLoad, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10 });
  }
  return points;
}

/* ═══════════════════════════════════════════════
   ACTIVITY CARD COMPONENTS
   ═══════════════════════════════════════════════ */

function HrZoneBar({ avgHr }: { avgHr: number | null }) {
  const zone = hrZone(avgHr);
  if (!zone) return null;
  return (
    <div style={{ display: "flex", gap: 1, height: 4, borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
      {ZONE_COLORS.map((c, i) => <div key={i} style={{ flex: 1, background: i < zone ? c : "#e5e7eb", opacity: i < zone ? 1 : 0.3 }} />)}
    </div>
  );
}

function WorkoutCard({ w, onClick }: { w: WorkoutLog; onClick?: () => void }) {
  const c = TYPE_COLORS.lift;
  const { totalSets, topExercises, avgRpe } = exerciseSummary(w.exercises);
  const load = Math.round((w.duration_minutes || 0) * 0.8);
  return (
    <div onClick={onClick} style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 10, lineHeight: 1.5, cursor: onClick ? "pointer" : "default", transition: "filter 0.1s" }} onMouseEnter={(e) => onClick && (e.currentTarget.style.filter = "brightness(0.95)")} onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{c.icon}</span>
        <span style={{ fontWeight: 700, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{w.name || "Workout"}</span>
      </div>
      <div style={{ fontWeight: 800, color: c.text, fontSize: 12 }}>{fmtMin(w.duration_minutes)}</div>
      <div style={{ color: "#6b7280", marginTop: 1 }}>{totalSets > 0 && <span>Load <b style={{ color: c.text }}>{load}</b> · {totalSets} sets</span>}</div>
      {avgRpe != null && <div style={{ marginTop: 2 }}><span style={{ background: c.border, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>RPE {avgRpe}</span></div>}
      {topExercises.length > 0 && <div style={{ color: "#9ca3af", marginTop: 3, fontSize: 9, lineHeight: 1.4 }}>{topExercises.join(" · ")}</div>}
      <div style={{ marginTop: 3, fontSize: 9, color: "#9ca3af" }}>{c.label}</div>
    </div>
  );
}

function teColor(te: number): string {
  if (te < 2) return "#22c55e";
  if (te < 3) return "#eab308";
  if (te < 4) return "#f97316";
  return "#ef4444";
}

const SOURCE_COLORS: Record<string, string> = {
  strava: "#FC4C02",
  garmin: "#0091D5",
  merged: "#8b5cf6",
};

function CardioCard({ c: a, onClick }: { c: CardioLog; onClick?: () => void }) {
  const t = cType(a.type); const cl = TYPE_COLORS[t];
  const zone = hrZone(a.avg_hr);
  return (
    <div onClick={onClick} style={{ background: cl.bg, borderLeft: `3px solid ${cl.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 10, lineHeight: 1.5, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{cl.icon}</span>
        <span style={{ fontWeight: 700, color: cl.text, fontSize: 11, flex: 1 }}>{fmtSec(a.duration)}</span>
        {a.training_effect_aerobic != null && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: teColor(a.training_effect_aerobic), borderRadius: 3, padding: "1px 4px" }}>
            TE {a.training_effect_aerobic.toFixed(1)}
          </span>
        )}
        {zone > 0 && !a.training_effect_aerobic && <span style={{ fontSize: 9, fontWeight: 700, color: ZONE_COLORS[zone - 1], background: "rgba(0,0,0,0.05)", borderRadius: 3, padding: "1px 4px" }}>Z{zone}</span>}
      </div>
      {a.distance > 0 && <div style={{ fontWeight: 800, color: cl.text, fontSize: 12 }}>{fmtDist(a.distance)} {distUnit()}</div>}
      <HrZoneBar avgHr={a.avg_hr} />
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "0 6px", marginTop: 2 }}>
        {a.pace_or_speed != null && a.pace_or_speed > 0 && <span>Pace {fmtPace(a.pace_or_speed)}</span>}
        {a.avg_hr != null && <span><span style={{ color: "#ef4444" }}>♥</span> {a.avg_hr}{a.max_hr ? ` / ${a.max_hr}` : ""}</span>}
        {a.vo2_max != null && <span style={{ color: "#6366f1" }}>V̇O₂ {Math.round(a.vo2_max)}</span>}
      </div>
      {(a.calories != null || a.elevation != null) && (
        <div style={{ color: "#9ca3af", display: "flex", gap: 6, marginTop: 1 }}>
          {a.calories != null && a.calories > 0 && <span>{Math.round(a.calories)} kcal</span>}
          {a.elevation != null && a.elevation > 0 && <span>↑{Math.round(a.elevation)}m</span>}
        </div>
      )}
      <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, color: "#9ca3af" }}>{cl.label}</span>
        {a.source && <span style={{ width: 5, height: 5, borderRadius: "50%", background: SOURCE_COLORS[a.source] || "#9ca3af", display: "inline-block" }} title={a.source} />}
      </div>
    </div>
  );
}

function RecoveryBar({ r, recoveryTimeMin }: { r: RecoveryLog; recoveryTimeMin?: number | null }) {
  const metrics: { icon: string; value: string; label: string; color: string }[] = [];
  if (r.sleep_hours !== null) {
    const c = r.sleep_hours >= 7 ? "#16a34a" : r.sleep_hours >= 6 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "😴", value: `${r.sleep_hours}h`, label: "Sleep", color: c });
  }
  if (r.sleep_score !== null) {
    const c = r.sleep_score >= 75 ? "#16a34a" : r.sleep_score >= 50 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "💤", value: `${r.sleep_score}`, label: "Score", color: c });
  }
  if (r.resting_hr !== null) {
    const c = r.resting_hr <= 55 ? "#16a34a" : r.resting_hr <= 65 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "♥", value: `${r.resting_hr}`, label: "RHR", color: c });
  }
  if (r.hrv !== null) {
    const c = r.hrv >= 50 ? "#16a34a" : r.hrv >= 35 ? "#ca8a04" : "#dc2626";
    metrics.push({ icon: "📊", value: `${r.hrv}`, label: "HRV", color: c });
  }
  if (r.steps !== null && r.steps > 0) {
    metrics.push({ icon: "👟", value: r.steps >= 1000 ? `${(r.steps / 1000).toFixed(1)}k` : `${r.steps}`, label: "Steps", color: "#6b7280" });
  }
  if (recoveryTimeMin != null && recoveryTimeMin > 0) {
    metrics.push({ icon: "⏱", value: `${Math.round(recoveryTimeMin / 60)}h`, label: "Recover", color: "#f97316" });
  }
  if (metrics.length === 0) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)`, gap: 1,
      background: "#f0f9ff", borderRadius: 4, padding: 3, border: "1px solid #e0f2fe",
    }}>
      {metrics.slice(0, 4).map((m, i) => (
        <div key={i} style={{ textAlign: "center", fontSize: 8, lineHeight: 1.2, padding: "2px 0" }}>
          <div style={{ fontSize: 10 }}>{m.icon}</div>
          <div style={{ fontWeight: 800, color: m.color, fontSize: 10 }}>{m.value}</div>
          <div style={{ color: "#94a3b8", fontSize: 7, fontWeight: 600 }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DAY COLUMN & WEEK ROW
   ═══════════════════════════════════════════════ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayColumn({ day, dayIndex, onWorkoutClick, onActivityClick }: { day: DayData; dayIndex: number; onWorkoutClick?: (w: WorkoutLog) => void; onActivityClick?: (c: CardioLog) => void }) {
  const today = toDS(new Date());
  const isToday = day.date === today;
  const isFuture = day.date > today;
  const isPast = day.date < today;
  const dayNum = day.dateObj.getDate();
  const hasActivity = day.workouts.length > 0 || day.cardio.length > 0;

  const compliance = isPast && day.planned
    ? getComplianceStatus(day.planned.session_type, day.workouts, day.cardio)
    : null;

  const maxRecoveryTime = day.cardio.reduce((max, c) => Math.max(max, c.recovery_time_min || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: (hasActivity || day.planned) ? 120 : 60, padding: "0 2px" }}>
      <div style={{ textAlign: "center", padding: "4px 0 2px", borderBottom: isToday ? "2px solid #3b82f6" : "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#fff" : "#374151", background: isToday ? "#3b82f6" : "transparent", width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{dayNum}</div>
        {compliance && <ComplianceBadge status={compliance} />}
      </div>
      {day.recovery && <RecoveryBar r={day.recovery} recoveryTimeMin={maxRecoveryTime || null} />}
      {day.workouts.map((w, i) => <WorkoutCard key={`w-${i}`} w={w} onClick={() => onWorkoutClick?.(w)} />)}
      {day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} onClick={onActivityClick ? () => onActivityClick(c) : undefined} />)}
      {day.planned && splitAmPmSessions(day.planned.session_type, day.planned.ai_notes, day.planned.targets).map((s, i) => (
        <PlannedCard
          key={`p-${i}`}
          variant={isToday ? "today" : isFuture ? "future" : "past"}
          sessionType={s.label}
          aiNotes={s.aiNotes}
          slot={s.slot}
          targets={s.targets}
        />
      ))}
    </div>
  );
}

function WeekRow({ days, weekNum, fitnessCurve, onWorkoutClick, onActivityClick }: { days: DayData[]; weekNum: number; fitnessCurve: FitnessPoint[]; onWorkoutClick?: (w: WorkoutLog) => void; onActivityClick?: (c: CardioLog) => void }) {
  const todayStr = toDS(new Date());
  // A week is "future" if its first day is after today
  const isFutureWeek = days[0].date > todayStr;
  // A week is "current" if today falls within it
  const isCurrentWeek = days[0].date <= todayStr && days[6].date >= todayStr;
  // Only show totals for past weeks and current week (with partial data)
  const hasData = !isFutureWeek;

  const t = hasData ? weekTotals(days) : null;
  const typeKeys = t ? Object.keys(t.byType).sort() : [];

  // Get fitness/fatigue/form for the last day of this week (or today if current week)
  const refDate = isCurrentWeek ? todayStr : days[6]?.date || days[days.length - 1]?.date;
  const weekPoint = hasData ? (fitnessCurve.find((p) => p.date === refDate) || [...fitnessCurve].reverse().find((p) => p.date <= refDate)) : null;
  const ctl = weekPoint?.ctl ?? 0;
  const atl = weekPoint?.atl ?? 0;
  const tsb = weekPoint?.tsb ?? 0;

  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ width: 150, flexShrink: 0, padding: "8px 10px", borderRight: "1px solid #e5e7eb", fontSize: 9, lineHeight: 1.6, background: "#fafafa" }}>
        <div style={{ fontWeight: 800, fontSize: 11, color: "#374151", marginBottom: 4 }}>Week {weekNum}</div>
        {t && t.timeSec > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Total</span><span style={{ fontWeight: 700 }}>{fmtSec(t.timeSec)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Load</span><span style={{ fontWeight: 700 }}>{t.load}</span></div>
            {t.kcal > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>kcal</span><span style={{ fontWeight: 700 }}>{t.kcal.toLocaleString()}</span></div>}
            {t.distKm > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Dist</span><span style={{ fontWeight: 700 }}>{fmtDist(t.distKm)} {distUnit()}</span></div>}
            {t.elevation > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Elev</span><span style={{ fontWeight: 700 }}>↑{t.elevation}m</span></div>}

            {/* Fitness / Fatigue / Form */}
            <div style={{ marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>Fitness</span>
                <span style={{ fontWeight: 800, color: "#3b82f6" }}>{ctl}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#f97316", fontWeight: 700 }}>Fatigue</span>
                <span style={{ fontWeight: 800, color: "#f97316" }}>{atl}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: tsb >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>Form</span>
                <span style={{ fontWeight: 800, color: tsb >= 0 ? "#22c55e" : "#ef4444" }}>{tsb}</span>
              </div>
            </div>

            {typeKeys.length > 0 && (
              <div style={{ marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 4 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700 }}><td></td><td style={{ textAlign: "right" }}>Time</td><td style={{ textAlign: "right" }}>Dist</td><td style={{ textAlign: "right" }}>Load</td></tr></thead>
                  <tbody>
                    {typeKeys.map((k) => { const bt = t.byType[k]; const c = TYPE_COLORS[k]; return (
                      <tr key={k}><td style={{ color: c?.text || "#374151", fontWeight: 600 }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: c?.border || "#999", marginRight: 3 }} />{c?.label || k}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtSec(bt.timeSec)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.distKm > 0 ? fmtDist(bt.distKm) : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.load}</td></tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Muscle diagram */}
            {(() => {
              const allExercises = days.flatMap((d) =>
                d.workouts.flatMap((w) => (Array.isArray(w.exercises) ? w.exercises : []) as Array<{ name: string; sets: Array<{ weight_kg: number; reps: number }> }>)
              );
              if (allExercises.length === 0) return null;
              const muscleData = computeMuscleVolume(allExercises);
              return (
                <div style={{ marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 4 }}>
                  <MuscleDiagram muscleData={muscleData} />
                </div>
              );
            })()}
          </>
        ) : isFutureWeek ? (
          <div style={{ color: "#d1d5db", fontSize: 10, fontStyle: "italic", marginTop: 4 }}>—</div>
        ) : (
          <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 4 }}>No activity</div>
        )}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, minWidth: 0 }}>
        {days.map((day, i) => (
          <div key={day.date} style={{ borderRight: i < 6 ? "1px solid #f3f4f6" : "none", padding: "0 1px" }}>
            <DayColumn day={day} dayIndex={i} onWorkoutClick={onWorkoutClick} onActivityClick={onActivityClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CLICKABLE CHART CARD (compact + expand)
   ═══════════════════════════════════════════════ */

function ChartCard({ title, description, onClick, children }: {
  title: string; description: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        padding: 14, cursor: "pointer", transition: "box-shadow .15s",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{title}</span>
        <span style={{ fontSize: 9, color: "#9ca3af", background: "#f3f4f6", borderRadius: 4, padding: "2px 6px" }}>Click to expand</span>
      </div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 8, lineHeight: 1.4 }}>{description}</div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MONTH NAV & CONNECTION BAR
   ═══════════════════════════════════════════════ */

function MonthNav({ monthDate, onPrev, onNext, onToday }: { monthDate: Date; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const label = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 12px" }}>
      <button onClick={onPrev} style={navBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></button>
      <button onClick={onNext} style={navBtn}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
      <button onClick={onToday} style={{ ...navBtn, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Today</button>
      <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginLeft: 8 }}>{label}</span>
    </div>
  );
}

const navBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "#374151" };

function ConnectionBar({ integrations, syncing, onSync }: { integrations: Integration[]; syncing: string | null; onSync: (p: string) => void }) {
  const providers = [
    { key: "hevy", label: "Hevy", color: "#0F1B22" },
    { key: "strava", label: "Strava", color: "#FC4C02" },
    { key: "garmin", label: "Garmin", color: "#0091D5" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, padding: "0 0 8px", fontSize: 11 }}>
      {providers.map((p) => {
        const int = integrations.find((i) => i.provider === p.key);
        const connected = !!int;
        return (
          <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? p.color : "#d1d5db", display: "inline-block" }} />
            <span style={{ fontWeight: 600, color: connected ? "#374151" : "#9ca3af" }}>{p.label}</span>
            {connected && int.last_synced_at && <span style={{ color: "#9ca3af", fontSize: 10 }}>{new Date(int.last_synced_at).toLocaleDateString()}</span>}
            {connected && <button onClick={() => onSync(p.key)} disabled={syncing === p.key} style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#6b7280" }}>{syncing === p.key ? "..." : "Sync"}</button>}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

type ModalKey = "fitness" | "hrv" | "sleep" | "rhr" | "bb" | "stress" | "hrzones" | "load" | null;

export default function DashboardPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [modal, setModal] = useState<ModalKey>(null);
  const [insights, setInsights] = useState<Record<string, string>>({});
  const [insightLoading, setInsightLoading] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitPreferences>({ distance: "mi", weight: "lbs" });
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutLog | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<CardioLog | null>(null);

  // Load unit preferences
  useEffect(() => {
    const prefs = getUnitPreferences();
    setUnits(prefs);
    _units = prefs;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const localToday = encodeURIComponent(formatCalendarDateLocal(new Date()));
    const res = await fetch(`/api/test-data?localToday=${localToday}`);
    if (res.ok) {
      const json = await res.json();
      setData({
        ...json,
        planned: Array.isArray(json.planned) ? json.planned : [],
      } as ApiData);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch AI insight when modal opens
  const fetchInsight = useCallback(async (section: string) => {
    if (insights[section]) return;
    setInsightLoading(section);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      if (res.ok) {
        const { insight } = await res.json();
        setInsights((prev) => ({ ...prev, [section]: insight }));
      }
    } catch { /* ignore */ }
    setInsightLoading(null);
  }, [insights]);

  useEffect(() => {
    if (modal === "fitness") fetchInsight("fitness");
    else if (modal === "hrzones" || modal === "load") fetchInsight("training");
    else if (modal && ["hrv", "sleep", "rhr", "bb", "stress"].includes(modal)) fetchInsight("recovery");
  }, [modal, fetchInsight]);

  // Month
  const monthDate = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);

  const weeks = useMemo(() => {
    if (!data) return [];
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const firstMonday = getMonday(firstOfMonth);
    const lastSunday = addDays(getMonday(lastOfMonth), 6);
    const weekCount = Math.round((lastSunday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
    return buildMonthWeeks(firstMonday, weekCount, data);
  }, [data, monthDate]);

  const fitnessCurve = useMemo(() => data ? computeFitnessCurve(data, 90) : [], [data]);

  const recoveryData: RecoveryPoint[] = useMemo(() => {
    if (!data) return [];
    return [...data.recovery].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const hrZones = useMemo(() => data ? computeHrZones(data.cardio) : [], [data]);

  const loadData: LoadPoint[] = useMemo(() => {
    if (!data) return [];
    const points: LoadPoint[] = [];
    for (const c of data.cardio) points.push({ date: c.date, load: estimateLoad(c.avg_hr, c.duration), type: cType(c.type) });
    for (const w of data.workouts) points.push({ date: w.date, load: Math.round((w.duration_minutes || 0) * 0.8), type: "lift" });
    return points;
  }, [data]);

  const weekNumbers = useMemo(() => weeks.map((w) => {
    const thu = addDays(w[0].dateObj, 3);
    const yearStart = new Date(thu.getFullYear(), 0, 1);
    return Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  }), [weeks]);

  const triggerSync = async (provider: string) => {
    setSyncing(provider);
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
    setTimeout(() => { fetchData(); setSyncing(null); }, 3000);
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" /></div>;
  if (!data) return <p style={{ padding: 32, color: "#6b7280" }}>Failed to load data.</p>;

  const insightFor = (section: string) => insights[section] || null;
  const isLoadingInsight = (section: string) => insightLoading === section;

  return (
    <div style={{ padding: "12px 20px 40px", maxWidth: 1600, margin: "0 auto" }}>
      <ConnectionBar integrations={data.integrations} syncing={syncing} onSync={triggerSync} />

      {/* ─── CHARTS GRID ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Fitness / Fatigue / Form — spans 2 cols */}
        <div style={{ gridColumn: "span 2" }}>
          <ChartCard title="Fitness / Fatigue / Form" description="CTL (42-day), ATL (7-day), TSB. Shows if you're building fitness or overreaching." onClick={() => setModal("fitness")}>
            <FitnessChart data={fitnessCurve} compact />
          </ChartCard>
        </div>

        {/* HR Zone Distribution */}
        <ChartCard title="HR Zone Distribution" description="Time spent in each HR zone across all cardio (last 90 days)." onClick={() => setModal("hrzones")}>
          <HrZoneChart zones={hrZones} compact />
        </ChartCard>

        {/* Training Load */}
        <ChartCard title="Weekly Training Load" description="Estimated weekly load from HR and duration. Consistency matters more than peaks." onClick={() => setModal("load")}>
          <TrainingLoadChart data={loadData} compact />
        </ChartCard>
      </div>

      {/* ─── RECOVERY TREND CARDS ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <ChartCard title="HRV" description="Heart rate variability — higher is better. Tracks nervous system recovery." onClick={() => setModal("hrv")}>
          <RecoveryTrendChart data={recoveryData} dataKey="hrv" color="#8b5cf6" label="HRV" unit="" compact />
        </ChartCard>
        <ChartCard title="Sleep" description="Total sleep hours per night. 7-9h is optimal for recovery." onClick={() => setModal("sleep")}>
          <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color="#3b82f6" label="Sleep" unit="h" compact />
        </ChartCard>
        <ChartCard title="Resting HR" description="Lower resting HR indicates better cardiovascular fitness." onClick={() => setModal("rhr")}>
          <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color="#ef4444" label="RHR" unit=" bpm" compact />
        </ChartCard>
        <ChartCard title="Body Battery" description="Garmin's energy reserve estimate. Starts high after sleep, drops with activity." onClick={() => setModal("bb")}>
          <RecoveryTrendChart data={recoveryData} dataKey="body_battery" color="#22c55e" label="Body Battery" unit="" compact />
        </ChartCard>
        <ChartCard title="Stress" description="Average daily stress level from Garmin. Lower is better, high values signal overtraining." onClick={() => setModal("stress")}>
          <RecoveryTrendChart data={recoveryData} dataKey="stress_level" color="#f97316" label="Stress" unit="" compact />
        </ChartCard>
      </div>

      {/* ─── MONTH CALENDAR ─── */}
      <MonthNav monthDate={monthDate} onPrev={() => setMonthOffset((o) => o - 1)} onNext={() => setMonthOffset((o) => o + 1)} onToday={() => setMonthOffset(0)} />

      <div style={{ display: "flex" }}>
        <div style={{ width: 140, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {DAY_NAMES.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 0" }}>{d}</div>)}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "auto" }}>
        {weeks.map((weekDays, wi) => <WeekRow key={weekDays[0].date} days={weekDays} weekNum={weekNumbers[wi]} fitnessCurve={fitnessCurve} onWorkoutClick={setSelectedWorkout} onActivityClick={setSelectedActivity} />)}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12, fontSize: 10, color: "#9ca3af" }}>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1.5px solid ${c.border}`, display: "inline-block" }} />{c.label}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {ZONE_COLORS.map((c, i) => <span key={i} style={{ width: 8, height: 4, borderRadius: 1, background: c, display: "inline-block" }} />)} HR Zones 1-5
        </span>
      </div>

      {/* ═══ MODALS ═══ */}

      <ChartModal open={modal === "fitness"} onClose={() => setModal(null)} title="Fitness / Fatigue / Form (CTL / ATL / TSB)" insight={insightFor("fitness")} insightLoading={isLoadingInsight("fitness")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          <b>Fitness (CTL)</b> is your 42-day rolling average training load — it represents your chronic training capacity. <b>Fatigue (ATL)</b> is the 7-day average — your acute tiredness. <b>Form (TSB = CTL - ATL)</b> tells you if you{"'"}re fresh (positive) or fatigued (negative). The sweet spot for racing is TSB between +5 and +25.
        </p>
        <FitnessChart data={fitnessCurve} />
      </ChartModal>

      <ChartModal open={modal === "hrzones"} onClose={() => setModal(null)} title="Heart Rate Zone Distribution" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          <b>Z1 Recovery</b> (&lt;120 bpm): Easy recovery, warm-up. <b>Z2 Aerobic</b> (120-140): Base building, fat burning — aim for 80% of training here. <b>Z3 Tempo</b> (140-155): Sustainable hard effort. <b>Z4 Threshold</b> (155-170): Race pace, lactate threshold. <b>Z5 Anaerobic</b> (170+): Max effort intervals. The 80/20 rule suggests 80% Z1-Z2, 20% Z3-Z5.
        </p>
        <HrZoneChart zones={hrZones} />
      </ChartModal>

      <ChartModal open={modal === "load"} onClose={() => setModal(null)} title="Weekly Training Load" insight={insightFor("training")} insightLoading={isLoadingInsight("training")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Training load is estimated from heart rate intensity and duration (TRIMP). Consistent weekly load with gradual increases ({"<"}10% per week) builds fitness safely. Big spikes increase injury risk. Dips are OK for recovery weeks.
        </p>
        <TrainingLoadChart data={loadData} />
      </ChartModal>

      <ChartModal open={modal === "hrv"} onClose={() => setModal(null)} title="Heart Rate Variability (HRV)" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          HRV measures the variation between heartbeats — higher values indicate better autonomic nervous system recovery. A downward trend over several days may signal overtraining, poor sleep, or illness. Your personal baseline matters more than absolute numbers.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="hrv" color="#8b5cf6" label="HRV" unit="" />
      </ChartModal>

      <ChartModal open={modal === "sleep"} onClose={() => setModal(null)} title="Sleep Duration" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Sleep is the #1 recovery tool. Athletes need 7-9 hours for optimal recovery, hormone production, and muscle repair. Consistency in sleep timing matters as much as duration.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="sleep_hours" color="#3b82f6" label="Sleep" unit="h" domain={[4, 10]} />
      </ChartModal>

      <ChartModal open={modal === "rhr"} onClose={() => setModal(null)} title="Resting Heart Rate" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Resting heart rate trends downward as cardiovascular fitness improves. A sudden spike (5+ bpm above baseline) can indicate illness, stress, dehydration, or overtraining. Track the 7-day average rather than individual readings.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="resting_hr" color="#ef4444" label="Resting HR" unit=" bpm" />
      </ChartModal>

      <ChartModal open={modal === "bb"} onClose={() => setModal(null)} title="Body Battery" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Garmin{"'"}s Body Battery estimates your energy reserves on a 0-100 scale using HRV, stress, sleep, and activity data. It charges during sleep and drains during activity and stress. Starting a hard session above 50 is ideal.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="body_battery" color="#22c55e" label="Body Battery" unit="" domain={[0, 100]} />
      </ChartModal>

      <ChartModal open={modal === "stress"} onClose={() => setModal(null)} title="Stress Level" insight={insightFor("recovery")} insightLoading={isLoadingInsight("recovery")}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: "0 0 16px" }}>
          Garmin{"'"}s stress score (0-100) is derived from HRV analysis. Under 25 is resting, 26-50 is low stress, 51-75 is medium, and 76+ is high. Chronically elevated stress without recovery days signals overtraining risk.
        </p>
        <RecoveryTrendChart data={recoveryData} dataKey="stress_level" color="#f97316" label="Stress" unit="" domain={[0, 100]} />
      </ChartModal>

      {/* Workout detail modal */}
      {selectedWorkout && (
        <WorkoutModal
          workout={selectedWorkout}
          open={true}
          onClose={() => setSelectedWorkout(null)}
        />
      )}

      <ActivityDetailModal
        open={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
      />
    </div>
  );
}
