"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

/* ─── Data interfaces ─── */

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
  exercises: unknown;
}

interface CardioLog {
  date: string;
  activity_id: string;
  type: string;
  distance: number;
  duration: number; // seconds
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

/* ─── Color config ─── */

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  lift:  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", icon: "🏋️" },
  run:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", icon: "🏃" },
  bike:  { bg: "#d1fae5", border: "#10b981", text: "#065f46", icon: "🚴" },
  swim:  { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3", icon: "🏊" },
  other: { bg: "#f3e8ff", border: "#8b5cf6", text: "#5b21b6", icon: "⚡" },
};

const PROVIDER_DOTS: Record<string, string> = {
  hevy: "#0F1B22",
  strava: "#FC4C02",
  garmin: "#0091D5",
};

/* ─── Helpers ─── */

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? `${String(m).padStart(2, "0")}m` : ""}`;
  return `${m}m`;
}

function fmtDurationMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h${m > 0 ? `${String(m).padStart(2, "0")}m` : ""}`;
  return `${m}m`;
}

function fmtPace(pace: number): string {
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function fmtDist(km: number): string {
  if (km >= 10) return `${Math.round(km * 10) / 10} km`;
  return `${Math.round(km * 100) / 100} km`;
}

function cardioType(t: string): string {
  if (t === "run") return "run";
  if (t === "bike") return "bike";
  if (t === "swim") return "swim";
  return "other";
}

/* ─── Day data builder ─── */

interface DayData {
  date: string;
  dateObj: Date;
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog | null;
}

function buildWeek(monday: Date, data: ApiData): DayData[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const ds = toDateStr(d);
    return {
      date: ds,
      dateObj: d,
      workouts: data.workouts.filter((w) => w.date === ds),
      cardio: data.cardio.filter((c) => c.date === ds),
      recovery: data.recovery.find((r) => r.date === ds) || null,
    };
  });
}

/* ─── Weekly totals ─── */

interface WeekTotals {
  totalTimeSec: number;
  totalDistKm: number;
  totalCalories: number;
  workoutCount: number;
  cardioCount: number;
  avgHr: number | null;
  avgHrv: number | null;
  avgSleep: number | null;
  avgBodyBattery: number | null;
}

function computeTotals(days: DayData[]): WeekTotals {
  let totalTimeSec = 0;
  let totalDistKm = 0;
  let totalCalories = 0;
  let workoutCount = 0;
  let cardioCount = 0;
  const hrs: number[] = [];
  const hrvs: number[] = [];
  const sleeps: number[] = [];
  const bbs: number[] = [];

  for (const day of days) {
    for (const w of day.workouts) {
      totalTimeSec += (w.duration_minutes || 0) * 60;
      workoutCount++;
    }
    for (const c of day.cardio) {
      totalTimeSec += c.duration || 0;
      totalDistKm += c.distance || 0;
      if (c.calories) totalCalories += c.calories;
      if (c.avg_hr) hrs.push(c.avg_hr);
      cardioCount++;
    }
    if (day.recovery) {
      if (day.recovery.hrv !== null) hrvs.push(day.recovery.hrv);
      if (day.recovery.sleep_hours !== null) sleeps.push(day.recovery.sleep_hours);
      if (day.recovery.body_battery !== null) bbs.push(day.recovery.body_battery);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  return {
    totalTimeSec,
    totalDistKm: Math.round(totalDistKm * 100) / 100,
    totalCalories: Math.round(totalCalories),
    workoutCount,
    cardioCount,
    avgHr: avg(hrs),
    avgHrv: avg(hrvs),
    avgSleep: sleeps.length > 0 ? Math.round(sleeps.reduce((a, b) => a + b, 0) / sleeps.length * 10) / 10 : null,
    avgBodyBattery: avg(bbs),
  };
}

/* ─── Activity card component ─── */

function WorkoutCard({ w }: { w: WorkoutLog }) {
  const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
  const c = TYPE_COLORS.lift;
  return (
    <div style={{
      background: c.bg, borderLeft: `3px solid ${c.border}`,
      borderRadius: 6, padding: "8px 10px", fontSize: 11,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        <span>{c.icon}</span>
        <span style={{ fontWeight: 700, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {w.name || "Workout"}
        </span>
      </div>
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "2px 8px", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: c.text }}>{fmtDurationMins(w.duration_minutes)}</span>
        {exerciseCount > 0 && <span>{exerciseCount} exercises</span>}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: PROVIDER_DOTS.hevy, display: "inline-block" }} />
        <span style={{ fontSize: 10, color: "#9ca3af" }}>Hevy</span>
      </div>
    </div>
  );
}

function CardioCard({ c: activity }: { c: CardioLog }) {
  const t = cardioType(activity.type);
  const colors = TYPE_COLORS[t];
  return (
    <div style={{
      background: colors.bg, borderLeft: `3px solid ${colors.border}`,
      borderRadius: 6, padding: "8px 10px", fontSize: 11,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
        <span>{colors.icon}</span>
        <span style={{ fontWeight: 700, color: colors.text, textTransform: "capitalize" }}>
          {activity.type}
        </span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.text }}>
          {fmtDuration(activity.duration)}
        </span>
      </div>
      <div style={{ color: "#6b7280", display: "flex", flexWrap: "wrap", gap: "2px 8px", lineHeight: 1.5 }}>
        {activity.distance > 0 && <span style={{ fontWeight: 600, color: colors.text }}>{fmtDist(activity.distance)}</span>}
        {activity.pace_or_speed != null && activity.pace_or_speed > 0 && <span>GAP {fmtPace(activity.pace_or_speed)}</span>}
        {activity.avg_hr != null && (
          <span>
            <span style={{ color: "#ef4444" }}>♥</span> {activity.avg_hr}
          </span>
        )}
      </div>
      {(activity.calories != null || activity.elevation != null) && (
        <div style={{ color: "#9ca3af", display: "flex", gap: 8, marginTop: 2, lineHeight: 1.5 }}>
          {activity.calories != null && activity.calories > 0 && <span>{Math.round(activity.calories)} kcal</span>}
          {activity.elevation != null && activity.elevation > 0 && <span>↑{Math.round(activity.elevation)}m</span>}
        </div>
      )}
      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: PROVIDER_DOTS.strava, display: "inline-block" }} />
        <span style={{ fontSize: 10, color: "#9ca3af" }}>Strava</span>
      </div>
    </div>
  );
}

function RecoveryRow({ r }: { r: RecoveryLog }) {
  return (
    <div style={{
      background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6,
      padding: "6px 8px", fontSize: 10, color: "#0369a1",
      display: "flex", flexWrap: "wrap", gap: "1px 8px", lineHeight: 1.6,
    }}>
      {r.hrv !== null && <span title="HRV"><b>HRV</b> {r.hrv}</span>}
      {r.sleep_hours !== null && <span title="Sleep"><b>Sleep</b> {r.sleep_hours}h</span>}
      {r.resting_hr !== null && <span title="Resting HR"><b>RHR</b> {r.resting_hr}</span>}
      {r.body_battery !== null && <span title="Body Battery"><b>BB</b> {r.body_battery}</span>}
      {r.steps !== null && <span title="Steps"><b>Steps</b> {r.steps.toLocaleString()}</span>}
      {r.stress_level !== null && <span title="Stress"><b>Stress</b> {r.stress_level}</span>}
    </div>
  );
}

/* ─── Day column ─── */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayColumn({ day, dayIndex }: { day: DayData; dayIndex: number }) {
  const isToday = day.date === toDateStr(new Date());
  const d = day.dateObj;
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hasActivities = day.workouts.length > 0 || day.cardio.length > 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      minWidth: 0,
    }}>
      {/* Day header */}
      <div style={{
        textAlign: "center", padding: "8px 4px",
        borderBottom: isToday ? "2px solid #3b82f6" : "1px solid #e5e7eb",
        background: isToday ? "#eff6ff" : "transparent",
        borderRadius: "6px 6px 0 0",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: isToday ? "#2563eb" : "#9ca3af",
        }}>
          {DAY_NAMES[dayIndex]}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: isToday ? "#1d4ed8" : "#374151",
        }}>
          {monthDay}
        </div>
      </div>

      {/* Recovery bar */}
      {day.recovery && <RecoveryRow r={day.recovery} />}

      {/* Activity cards */}
      {day.workouts.map((w, i) => <WorkoutCard key={`w-${i}`} w={w} />)}
      {day.cardio.map((c, i) => <CardioCard key={`c-${i}`} c={c} />)}

      {/* Empty state */}
      {!hasActivities && !day.recovery && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#d1d5db", fontSize: 11, fontStyle: "italic", minHeight: 60,
        }}>
          Rest
        </div>
      )}
    </div>
  );
}

/* ─── Weekly totals panel ─── */

function WeekTotalsPanel({ totals, weekNumber }: { totals: WeekTotals; weekNumber: number }) {
  const stats = [
    { label: "Total", value: fmtDuration(totals.totalTimeSec), icon: "⏱" },
    { label: "Distance", value: totals.totalDistKm > 0 ? `${totals.totalDistKm} km` : "—", icon: "📏" },
    { label: "kcal", value: totals.totalCalories > 0 ? totals.totalCalories.toLocaleString() : "—", icon: "🔥" },
    { label: "Workouts", value: `${totals.workoutCount}`, icon: "🏋️" },
    { label: "Cardio", value: `${totals.cardioCount}`, icon: "🏃" },
  ];

  const recovery = [
    { label: "Avg HRV", value: totals.avgHrv !== null ? `${totals.avgHrv}` : "—" },
    { label: "Avg Sleep", value: totals.avgSleep !== null ? `${totals.avgSleep}h` : "—" },
    { label: "Avg BB", value: totals.avgBodyBattery !== null ? `${totals.avgBodyBattery}` : "—" },
    { label: "Avg HR", value: totals.avgHr !== null ? `${totals.avgHr} bpm` : "—" },
  ];

  return (
    <div style={{
      width: 160, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 12,
      fontSize: 11,
    }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#374151" }}>
        Week {weekNumber}
      </div>

      {/* Activity stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#6b7280" }}>{s.icon} {s.label}</span>
            <span style={{ fontWeight: 700, color: "#111827" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#e5e7eb" }} />

      {/* Recovery averages */}
      <div style={{ fontSize: 10, color: "#6b7280" }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#0369a1" }}>Recovery Avg</div>
        {recovery.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#e5e7eb" }} />

      {/* Connection status indicators */}
      <div style={{ fontSize: 10, color: "#9ca3af" }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: "#6b7280" }}>Sources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {Object.entries(PROVIDER_DOTS).map(([key, color]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
              <span style={{ textTransform: "capitalize" }}>{key}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Week navigation ─── */

function WeekNav({ weekStart, onPrev, onNext, onToday }: {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const weekEnd = addDays(weekStart, 6);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const year = weekStart.getFullYear();

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onPrev} style={navBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button onClick={onNext} style={navBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <button onClick={onToday} style={{ ...navBtnStyle, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>
          Today
        </button>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
        {fmtDate(weekStart)} — {fmtDate(weekEnd)}, {year}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
  padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center",
  color: "#374151",
};

/* ─── Main page ─── */

export default function DashboardPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/test-data");
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    return addDays(m, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    if (!data) return [];
    return buildWeek(monday, data);
  }, [data, monday]);

  const totals = useMemo(() => computeTotals(weekDays), [weekDays]);

  // Week number (ISO)
  const weekNumber = useMemo(() => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 3);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  }, [monday]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 80 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
      </div>
    );
  }

  if (!data) {
    return <p style={{ padding: 32, color: "#6b7280" }}>Failed to load data.</p>;
  }

  return (
    <div style={{ padding: "16px 24px", maxWidth: 1400, margin: "0 auto" }}>
      <WeekNav
        weekStart={monday}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        onToday={() => setWeekOffset(0)}
      />

      <div style={{ display: "flex", gap: 20 }}>
        {/* Weekly totals panel */}
        <WeekTotalsPanel totals={totals} weekNumber={weekNumber} />

        {/* 7-day calendar grid */}
        <div style={{
          flex: 1, display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8, minWidth: 0,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          padding: 12,
        }}>
          {weekDays.map((day, i) => (
            <DayColumn key={day.date} day={day} dayIndex={i} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16,
        fontSize: 11, color: "#9ca3af",
      }}>
        {Object.entries(TYPE_COLORS).map(([type, c]) => (
          <span key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3,
              background: c.bg, border: `1.5px solid ${c.border}`, display: "inline-block",
            }} />
            <span style={{ textTransform: "capitalize" }}>{type}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
