"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

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
    sets: Array<{
      index: number;
      type: string;
      weight_kg: number;
      reps: number;
      rpe: number | null;
    }>;
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

interface ApiData {
  integrations: Integration[];
  nutrition: unknown[];
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog[];
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
function toDS(d: Date): string { return d.toISOString().slice(0, 10); }
function fmtSec(s: number): string { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") + "m" : ""}` : `${m}m`; }
function fmtMin(m: number): string { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h${mm > 0 ? String(mm).padStart(2, "0") + "m" : ""}` : `${m}m`; }
function fmtPace(p: number): string { const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${String(s).padStart(2, "0")}/km`; }
function fmtDist(km: number): string { return km >= 10 ? `${(Math.round(km * 10) / 10).toFixed(1)}` : `${(Math.round(km * 100) / 100).toFixed(2)}`; }
function cType(t: string): string { return t === "run" ? "run" : t === "bike" ? "bike" : t === "swim" ? "swim" : "other"; }

/** Estimate TRIMP training load from avg HR and duration */
function estimateLoad(avgHr: number | null, durationSec: number): number {
  if (!avgHr || durationSec <= 0) return 0;
  // Simplified TRIMP: duration(min) * (avgHR/180) * intensity factor
  const dMin = durationSec / 60;
  const hrFraction = avgHr / 180;
  return Math.round(dMin * hrFraction * hrFraction * 1.5);
}

/** Estimate HR zone (1-5) from avg HR */
function hrZone(avgHr: number | null): number {
  if (!avgHr) return 0;
  if (avgHr < 120) return 1;
  if (avgHr < 140) return 2;
  if (avgHr < 155) return 3;
  if (avgHr < 170) return 4;
  return 5;
}

/** Get exercise summary from workout: total sets, top exercises */
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
   DAY DATA
   ═══════════════════════════════════════════════ */

interface DayData {
  date: string;
  dateObj: Date;
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog | null;
}

function buildMonthWeeks(firstMonday: Date, weekCount: number, data: ApiData): DayData[][] {
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
      });
    }
    weeks.push(days);
  }
  return weeks;
}

/* ═══════════════════════════════════════════════
   WEEK TOTALS
   ═══════════════════════════════════════════════ */

interface WeekTotals {
  timeSec: number;
  distKm: number;
  kcal: number;
  load: number;
  workouts: number;
  cardioSessions: number;
  byType: Record<string, { timeSec: number; distKm: number; load: number; count: number }>;
}

function weekTotals(days: DayData[]): WeekTotals {
  const t: WeekTotals = { timeSec: 0, distKm: 0, kcal: 0, load: 0, workouts: 0, cardioSessions: 0, byType: {} };
  for (const day of days) {
    for (const w of day.workouts) {
      const sec = (w.duration_minutes || 0) * 60;
      t.timeSec += sec;
      t.workouts++;
      const load = Math.round(sec / 60 * 0.8); // rough estimate for lifting
      t.load += load;
      const k = "lift";
      if (!t.byType[k]) t.byType[k] = { timeSec: 0, distKm: 0, load: 0, count: 0 };
      t.byType[k].timeSec += sec;
      t.byType[k].load += load;
      t.byType[k].count++;
    }
    for (const c of day.cardio) {
      t.timeSec += c.duration || 0;
      t.distKm += c.distance || 0;
      if (c.calories) t.kcal += c.calories;
      const load = estimateLoad(c.avg_hr, c.duration);
      t.load += load;
      t.cardioSessions++;
      const k = cType(c.type);
      if (!t.byType[k]) t.byType[k] = { timeSec: 0, distKm: 0, load: 0, count: 0 };
      t.byType[k].timeSec += c.duration || 0;
      t.byType[k].distKm += c.distance || 0;
      t.byType[k].load += load;
      t.byType[k].count++;
    }
  }
  t.distKm = Math.round(t.distKm * 100) / 100;
  t.kcal = Math.round(t.kcal);
  return t;
}

/* ═══════════════════════════════════════════════
   FITNESS / FATIGUE / FORM (CTL / ATL / TSB)
   ═══════════════════════════════════════════════ */

interface FitnessPoint { date: string; load: number; ctl: number; atl: number; tsb: number; }

function computeFitnessCurve(data: ApiData, numDays: number): FitnessPoint[] {
  const today = new Date();
  const points: FitnessPoint[] = [];
  let ctl = 0, atl = 0;

  for (let i = numDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const ds = toDS(d);
    let dayLoad = 0;
    for (const c of data.cardio.filter((x) => x.date === ds)) {
      dayLoad += estimateLoad(c.avg_hr, c.duration);
    }
    for (const w of data.workouts.filter((x) => x.date === ds)) {
      dayLoad += Math.round((w.duration_minutes || 0) * 0.8);
    }
    ctl = ctl + (dayLoad - ctl) / 42;
    atl = atl + (dayLoad - atl) / 7;
    points.push({ date: ds, load: dayLoad, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round((ctl - atl) * 10) / 10 });
  }
  return points;
}

/* ═══════════════════════════════════════════════
   SVG CHART COMPONENTS
   ═══════════════════════════════════════════════ */

function MiniLineChart({ points, width, height, color, label, unit, data: rawData }: {
  points: number[];
  width: number;
  height: number;
  color: string;
  label: string;
  unit: string;
  data?: { date: string; value: number }[];
}) {
  if (points.length < 2) return <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 11 }}>No data</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2 - 20;
  const pathPoints = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * w;
    const y = pad + 20 + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const current = points[points.length - 1];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 800 }}>{Math.round(current)}{unit}</span>
      </div>
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${pathPoints[0]} ${pathPoints.slice(1).map((p) => `L${p}`).join(" ")} L${pad + w},${pad + 20 + h} L${pad},${pad + 20 + h} Z`} fill={`url(#grad-${label})`} />
        <polyline points={pathPoints.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={pad + w} cy={pad + 20 + h - ((current - min) / range) * h} r="3" fill={color} />
      </svg>
    </div>
  );
}

function FitnessChart({ curve, width, height }: { curve: FitnessPoint[]; width: number; height: number }) {
  if (curve.length < 7) return null;
  const last42 = curve.slice(-42);
  const allVals = last42.flatMap((p) => [p.ctl, p.atl, p.tsb]);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2 - 24;

  const toPath = (vals: number[]) => vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * w;
    const y = pad + 24 + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const ctlPath = toPath(last42.map((p) => p.ctl));
  const atlPath = toPath(last42.map((p) => p.atl));
  const tsbPath = toPath(last42.map((p) => p.tsb));
  const lastP = last42[last42.length - 1];

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "flex", gap: 12 }}>
        <span>Fitness / Fatigue / Form</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <span style={{ color: "#3b82f6" }}>CTL {lastP.ctl}</span>
          <span style={{ color: "#f97316" }}>ATL {lastP.atl}</span>
          <span style={{ color: lastP.tsb >= 0 ? "#22c55e" : "#ef4444" }}>TSB {lastP.tsb}</span>
        </span>
      </div>
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Zero line if visible */}
        {min < 0 && max > 0 && (
          <line x1={pad} x2={pad + w} y1={pad + 24 + h - ((0 - min) / range) * h} y2={pad + 24 + h - ((0 - min) / range) * h} stroke="#e5e7eb" strokeDasharray="3 3" />
        )}
        <polyline points={ctlPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <polyline points={atlPath} fill="none" stroke="#f97316" strokeWidth="1.5" />
        <polyline points={tsbPath} fill="none" stroke={lastP.tsb >= 0 ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ACTIVITY CARD COMPONENTS
   ═══════════════════════════════════════════════ */

function HrZoneBar({ avgHr }: { avgHr: number | null }) {
  const zone = hrZone(avgHr);
  if (!zone) return null;
  return (
    <div style={{ display: "flex", gap: 1, height: 4, borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
      {ZONE_COLORS.map((c, i) => (
        <div key={i} style={{ flex: 1, background: i < zone ? c : "#e5e7eb", opacity: i < zone ? 1 : 0.3 }} />
      ))}
    </div>
  );
}

function WorkoutCard({ w }: { w: WorkoutLog }) {
  const c = TYPE_COLORS.lift;
  const { totalSets, topExercises, avgRpe } = exerciseSummary(w.exercises);
  const load = Math.round((w.duration_minutes || 0) * 0.8);
  return (
    <div style={{ background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 10, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{c.icon}</span>
        <span style={{ fontWeight: 700, color: c.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
          {w.name || "Workout"}
        </span>
      </div>
      <div style={{ fontWeight: 800, color: c.text, fontSize: 12 }}>{fmtMin(w.duration_minutes)}</div>
      <div style={{ color: "#6b7280", marginTop: 1 }}>
        {totalSets > 0 && <span>Load <b style={{ color: c.text }}>{load}</b> · {totalSets} sets</span>}
      </div>
      {avgRpe != null && (
        <div style={{ marginTop: 2 }}>
          <span style={{ background: c.border, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>
            RPE {avgRpe}
          </span>
        </div>
      )}
      {topExercises.length > 0 && (
        <div style={{ color: "#9ca3af", marginTop: 3, fontSize: 9, lineHeight: 1.4 }}>
          {topExercises.join(" · ")}
        </div>
      )}
      <div style={{ marginTop: 3, fontSize: 9, color: "#9ca3af" }}>{c.label}</div>
    </div>
  );
}

function CardioCard({ c: a }: { c: CardioLog }) {
  const t = cType(a.type);
  const cl = TYPE_COLORS[t];
  const load = estimateLoad(a.avg_hr, a.duration);
  const zone = hrZone(a.avg_hr);
  return (
    <div style={{ background: cl.bg, borderLeft: `3px solid ${cl.border}`, borderRadius: 5, padding: "6px 8px", fontSize: 10, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 12 }}>{cl.icon}</span>
        <span style={{ fontWeight: 700, color: cl.text, fontSize: 11, flex: 1 }}>{fmtSec(a.duration)}</span>
        {zone > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: ZONE_COLORS[zone - 1], background: "rgba(0,0,0,0.05)", borderRadius: 3, padding: "1px 4px" }}>Z{zone}</span>}
      </div>
      {a.distance > 0 && (
        <div style={{ fontWeight: 800, color: cl.text, fontSize: 12 }}>{fmtDist(a.distance)} km</div>
      )}
      <HrZoneBar avgHr={a.avg_hr} />
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "0 6px", marginTop: 2 }}>
        {load > 0 && <span>Load <b style={{ color: cl.text }}>{load}</b></span>}
        {a.pace_or_speed != null && a.pace_or_speed > 0 && <span>GAP {fmtPace(a.pace_or_speed)}</span>}
        {a.avg_hr != null && <span><span style={{ color: "#ef4444" }}>♥</span> {a.avg_hr}</span>}
      </div>
      {(a.calories != null || a.elevation != null) && (
        <div style={{ color: "#9ca3af", display: "flex", gap: 6, marginTop: 1 }}>
          {a.calories != null && a.calories > 0 && <span>{Math.round(a.calories)} kcal</span>}
          {a.elevation != null && a.elevation > 0 && <span>↑{Math.round(a.elevation)}m</span>}
        </div>
      )}
      <div style={{ marginTop: 3, fontSize: 9, color: "#9ca3af" }}>{cl.label}</div>
    </div>
  );
}

function RecoveryBar({ r }: { r: RecoveryLog }) {
  return (
    <div style={{
      background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 4,
      padding: "4px 6px", fontSize: 9, color: "#0369a1",
      display: "flex", flexWrap: "wrap", gap: "0 6px", lineHeight: 1.6,
    }}>
      {r.hrv !== null && <span><b>HRV</b> {r.hrv}</span>}
      {r.sleep_hours !== null && <span><b>Sleep</b> {r.sleep_hours}h</span>}
      {r.resting_hr !== null && <span><b>RHR</b> {r.resting_hr}</span>}
      {r.body_battery !== null && <span><b>BB</b> {r.body_battery}</span>}
      {r.steps !== null && <span>{r.steps.toLocaleString()} steps</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DAY COLUMN
   ═══════════════════════════════════════════════ */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayColumn({ day, dayIndex, isHeader }: { day: DayData; dayIndex: number; isHeader?: boolean }) {
  const isToday = day.date === toDS(new Date());
  const d = day.dateObj;
  const dayNum = d.getDate();
  const hasActivity = day.workouts.length > 0 || day.cardio.length > 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: hasActivity ? 120 : 60,
      padding: "0 2px",
    }}>
      {/* Date number */}
      <div style={{
        textAlign: "center", padding: "4px 0 2px",
        borderBottom: isToday ? "2px solid #3b82f6" : "1px solid #f3f4f6",
      }}>
        {isHeader && (
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af" }}>
            {DAY_NAMES[dayIndex]}
          </div>
        )}
        <div style={{
          fontSize: 13, fontWeight: 800,
          color: isToday ? "#fff" : "#374151",
          background: isToday ? "#3b82f6" : "transparent",
          width: 24, height: 24, borderRadius: "50%",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {dayNum}
        </div>
      </div>

      {/* Recovery */}
      {day.recovery && <RecoveryBar r={day.recovery} />}

      {/* Activities */}
      {day.workouts.map((w, i) => <WorkoutCard key={`w-${i}`} w={w} />)}
      {day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   WEEK ROW (totals + 7 days)
   ═══════════════════════════════════════════════ */

function WeekRow({ days, weekNum, isFirstWeek }: { days: DayData[]; weekNum: number; isFirstWeek: boolean }) {
  const t = weekTotals(days);
  const typeKeys = Object.keys(t.byType).sort();

  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
      {/* Week totals column */}
      <div style={{
        width: 140, flexShrink: 0, padding: "8px 10px",
        borderRight: "1px solid #e5e7eb",
        fontSize: 9, lineHeight: 1.6, background: "#fafafa",
      }}>
        <div style={{ fontWeight: 800, fontSize: 11, color: "#374151", marginBottom: 4 }}>Week {weekNum}</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280" }}>Total</span>
          <span style={{ fontWeight: 700 }}>{fmtSec(t.timeSec)}</span>
        </div>
        {t.kcal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>kcal</span>
            <span style={{ fontWeight: 700 }}>{t.kcal.toLocaleString()}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280" }}>Load</span>
          <span style={{ fontWeight: 700 }}>{t.load}</span>
        </div>
        {t.distKm > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6b7280" }}>Dist</span>
            <span style={{ fontWeight: 700 }}>{t.distKm} km</span>
          </div>
        )}

        {/* Per-type breakdown */}
        {typeKeys.length > 0 && (
          <div style={{ marginTop: 6, borderTop: "1px solid #e5e7eb", paddingTop: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ fontSize: 8, color: "#9ca3af", fontWeight: 700 }}>
                  <td></td><td style={{ textAlign: "right" }}>Time</td><td style={{ textAlign: "right" }}>Dist</td><td style={{ textAlign: "right" }}>Load</td>
                </tr>
              </thead>
              <tbody>
                {typeKeys.map((k) => {
                  const bt = t.byType[k];
                  const c = TYPE_COLORS[k];
                  return (
                    <tr key={k}>
                      <td style={{ color: c?.text || "#374151", fontWeight: 600 }}>
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: c?.border || "#999", marginRight: 3 }} />
                        {c?.label || k}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtSec(bt.timeSec)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.distKm > 0 ? `${Math.round(bt.distKm * 10) / 10}` : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{bt.load}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7 day columns */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, minWidth: 0 }}>
        {days.map((day, i) => (
          <div key={day.date} style={{ borderRight: i < 6 ? "1px solid #f3f4f6" : "none", padding: "0 1px" }}>
            <DayColumn day={day} dayIndex={i} isHeader={isFirstWeek} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MONTH NAVIGATION
   ═══════════════════════════════════════════════ */

function MonthNav({ monthDate, onPrev, onNext, onToday }: {
  monthDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const label = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 12px" }}>
      <button onClick={onPrev} style={navBtn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <button onClick={onNext} style={navBtn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button onClick={onToday} style={{ ...navBtn, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Today</button>
      <span style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", marginLeft: 8 }}>{label}</span>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
  padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", color: "#374151",
};

/* ═══════════════════════════════════════════════
   CONNECTION STATUS BAR
   ═══════════════════════════════════════════════ */

function ConnectionBar({ integrations, syncing, onSync }: {
  integrations: Integration[];
  syncing: string | null;
  onSync: (p: string) => void;
}) {
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
            {connected && int.last_synced_at && (
              <span style={{ color: "#9ca3af", fontSize: 10 }}>
                {new Date(int.last_synced_at).toLocaleDateString()}
              </span>
            )}
            {connected && (
              <button
                onClick={() => onSync(p.key)}
                disabled={syncing === p.key}
                style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#6b7280" }}
              >
                {syncing === p.key ? "..." : "Sync"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function DashboardPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/test-data");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Month calculation
  const monthDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  // Build weeks for this month view (include partial weeks at start/end)
  const weeks = useMemo(() => {
    if (!data) return [];
    const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const firstMonday = getMonday(firstOfMonth);
    const lastSunday = addDays(getMonday(lastOfMonth), 6);
    const weekCount = Math.round((lastSunday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
    return buildMonthWeeks(firstMonday, weekCount, data);
  }, [data, monthDate]);

  // Fitness curve
  const fitnessCurve = useMemo(() => {
    if (!data) return [];
    return computeFitnessCurve(data, 90);
  }, [data]);

  // Recovery trends (last 30 days)
  const recoveryTrends = useMemo(() => {
    if (!data) return { hrv: [] as number[], sleep: [] as number[], bb: [] as number[], rhr: [] as number[] };
    const sorted = [...data.recovery].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    return {
      hrv: sorted.filter((r) => r.hrv !== null).map((r) => r.hrv!),
      sleep: sorted.filter((r) => r.sleep_hours !== null).map((r) => r.sleep_hours!),
      bb: sorted.filter((r) => r.body_battery !== null).map((r) => r.body_battery!),
      rhr: sorted.filter((r) => r.resting_hr !== null).map((r) => r.resting_hr!),
    };
  }, [data]);

  // Week numbers
  const weekNumbers = useMemo(() => {
    return weeks.map((w) => {
      const thu = addDays(w[0].dateObj, 3);
      const yearStart = new Date(thu.getFullYear(), 0, 1);
      return Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
    });
  }, [weeks]);

  const triggerSync = async (provider: string) => {
    setSyncing(provider);
    await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
    setTimeout(() => { fetchData(); setSyncing(null); }, 3000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 120 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }
  if (!data) return <p style={{ padding: 32, color: "#6b7280" }}>Failed to load data.</p>;

  return (
    <div style={{ padding: "12px 20px 40px", maxWidth: 1600, margin: "0 auto" }}>
      {/* Connection bar */}
      <ConnectionBar integrations={data.integrations} syncing={syncing} onSync={triggerSync} />

      {/* Graphs row */}
      <div style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
        gap: 12, marginBottom: 16,
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14,
      }}>
        <FitnessChart curve={fitnessCurve} width={320} height={90} />
        <MiniLineChart points={recoveryTrends.hrv} width={150} height={90} color="#8b5cf6" label="HRV" unit="" />
        <MiniLineChart points={recoveryTrends.sleep} width={150} height={90} color="#3b82f6" label="Sleep" unit="h" />
        <MiniLineChart points={recoveryTrends.bb} width={150} height={90} color="#22c55e" label="Body Battery" unit="" />
        <MiniLineChart points={recoveryTrends.rhr} width={150} height={90} color="#ef4444" label="Resting HR" unit="" />
      </div>

      {/* Month navigation */}
      <MonthNav
        monthDate={monthDate}
        onPrev={() => setMonthOffset((o) => o - 1)}
        onNext={() => setMonthOffset((o) => o + 1)}
        onToday={() => setMonthOffset(0)}
      />

      {/* Day-of-week headers */}
      <div style={{ display: "flex" }}>
        <div style={{ width: 140, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {DAY_NAMES.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 0" }}>
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable calendar */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
        overflow: "auto",
      }}>
        {weeks.map((weekDays, wi) => (
          <WeekRow key={weekDays[0].date} days={weekDays} weekNum={weekNumbers[wi]} isFirstWeek={false} />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12, fontSize: 10, color: "#9ca3af" }}>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1.5px solid ${c.border}`, display: "inline-block" }} />
            {c.label}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {ZONE_COLORS.map((c, i) => <span key={i} style={{ width: 8, height: 4, borderRadius: 1, background: c, display: "inline-block" }} />)}
          HR Zones 1-5
        </span>
      </div>
    </div>
  );
}
