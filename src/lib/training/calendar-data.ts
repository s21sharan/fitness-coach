import type { ApiData, CardioLog, PlannedWorkout, RecoveryLog, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import { formatCalendarDateLocal } from "@/lib/dates/local-calendar";
import type { FitnessPoint } from "@/components/charts/fitness-chart";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  lift:  { bg: "#fef9c3", border: "#eab308", text: "#854d0e", icon: "🏋️", label: "Strength" },
  run:   { bg: "#dcfce7", border: "#22c55e", text: "#166534", icon: "🏃", label: "Running" },
  bike:  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af", icon: "🚴", label: "Cycling" },
  swim:  { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3", icon: "🏊", label: "Swimming" },
  other: { bg: "#f3e8ff", border: "#8b5cf6", text: "#5b21b6", icon: "⚡", label: "Other" },
};

export const ZONE_COLORS = ["#93c5fd", "#86efac", "#fde047", "#fb923c", "#f87171"];

export interface ZoneBoundary {
  zone: number;
  low: number;
  high: number;
}

export interface UserHrZones {
  source: "garmin" | "legacy";
  boundaries: ZoneBoundary[];
  syncedAt: string | null;
}

const LEGACY_BOUNDARIES: ZoneBoundary[] = [
  { zone: 1, low: 0, high: 120 },
  { zone: 2, low: 120, high: 140 },
  { zone: 3, low: 140, high: 155 },
  { zone: 4, low: 155, high: 170 },
  { zone: 5, low: 170, high: 250 },
];

export function zoneRangeLabel(b: ZoneBoundary, isFirst: boolean, isLast: boolean): string {
  if (isFirst) return `< ${b.high} bpm`;
  if (isLast) return `${b.low}+ bpm`;
  return `${b.low}-${b.high} bpm`;
}

export interface DayData {
  date: string;
  dateObj: Date;
  workouts: WorkoutLog[];
  cardio: CardioLog[];
  recovery: RecoveryLog | null;
  planned: PlannedWorkout | null;
}

export interface WeekTotals {
  timeSec: number;
  distKm: number;
  kcal: number;
  load: number;
  elevation: number;
  workouts: number;
  cardioSessions: number;
  byType: Record<string, { timeSec: number; distKm: number; load: number; count: number }>;
}

export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toDS(d: Date): string {
  return formatCalendarDateLocal(d);
}

export function fmtSec(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") + "m" : ""}` : `${m}m`;
}

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h${mm > 0 ? String(mm).padStart(2, "0") + "m" : ""}` : `${m}m`;
}

export function cType(t: string): string {
  if (t === "run" || t === "bike" || t === "swim") return t;
  // Strava lift activities that didn't get suppressed (e.g. no Hevy
  // connected) reach the dashboard as type="strength" — render them with
  // the same styling as planned/Hevy lifts.
  if (t === "strength") return "lift";
  return "other";
}

export function estimateLoad(avgHr: number | null, durationSec: number): number {
  if (!avgHr || durationSec <= 0) return 0;
  const dMin = durationSec / 60;
  const hrFraction = avgHr / 180;
  return Math.round(dMin * hrFraction * hrFraction * 1.5);
}

export function hrZone(avgHr: number | null, boundaries?: ZoneBoundary[] | null): number {
  if (!avgHr) return 0;
  const bs = boundaries && boundaries.length === 5 ? boundaries : LEGACY_BOUNDARIES;
  // Top zone catches anything at or above its low.
  for (let i = bs.length - 1; i >= 0; i--) {
    if (avgHr >= bs[i].low) return bs[i].zone;
  }
  return bs[0].zone;
}

export function exerciseSummary(exercises: unknown): { totalSets: number; topExercises: string[]; avgRpe: number | null } {
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

export function buildWeek(firstMonday: Date, data: ApiData): DayData[] {
  const plannedForRange = data.planned ?? [];
  const days: DayData[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(firstMonday, d);
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
  return days;
}

export function buildMonthWeeks(firstMonday: Date, weekCount: number, data: ApiData): DayData[][] {
  const weeks: DayData[][] = [];
  for (let w = 0; w < weekCount; w++) {
    weeks.push(buildWeek(addDays(firstMonday, w * 7), data));
  }
  return weeks;
}

export function weekTotals(days: DayData[]): WeekTotals {
  const t: WeekTotals = { timeSec: 0, distKm: 0, kcal: 0, load: 0, elevation: 0, workouts: 0, cardioSessions: 0, byType: {} };
  for (const day of days) {
    for (const w of day.workouts) {
      const sec = (w.duration_minutes || 0) * 60;
      t.timeSec += sec;
      t.workouts++;
      const load = Math.round(sec / 60 * 0.8);
      t.load += load;
      if (!t.byType.lift) t.byType.lift = { timeSec: 0, distKm: 0, load: 0, count: 0 };
      t.byType.lift.timeSec += sec;
      t.byType.lift.load += load;
      t.byType.lift.count++;
    }
    for (const c of day.cardio) {
      t.timeSec += c.duration || 0;
      t.distKm += c.distance || 0;
      if (c.calories) t.kcal += c.calories;
      if (c.elevation) t.elevation += c.elevation;
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
  t.elevation = Math.round(t.elevation);
  return t;
}

export interface LoadByTypePoint {
  week: string;
  lift: number;
  run: number;
  bike: number;
  swim: number;
  other: number;
  total: number;
}

function mondayKey(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

export function computeLoadByType(data: ApiData, weeks: number = 12): LoadByTypePoint[] {
  const weekMap = new Map<string, LoadByTypePoint>();
  const blank = (week: string): LoadByTypePoint => ({ week, lift: 0, run: 0, bike: 0, swim: 0, other: 0, total: 0 });

  for (const c of data.cardio) {
    const week = mondayKey(c.date);
    const bucket = weekMap.get(week) || blank(week);
    const k = cType(c.type) as "lift" | "run" | "bike" | "swim" | "other";
    const load = estimateLoad(c.avg_hr, c.duration);
    if (k === "lift" || k === "run" || k === "bike" || k === "swim" || k === "other") {
      bucket[k] += load;
    } else {
      bucket.other += load;
    }
    bucket.total += load;
    weekMap.set(week, bucket);
  }

  for (const w of data.workouts) {
    const week = mondayKey(w.date);
    const bucket = weekMap.get(week) || blank(week);
    const load = Math.round((w.duration_minutes || 0) * 0.8);
    bucket.lift += load;
    bucket.total += load;
    weekMap.set(week, bucket);
  }

  return Array.from(weekMap.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-weeks);
}

export interface Vo2Point {
  date: string;
  run: number | null;
  bike: number | null;
}

export function computeVo2Trend(data: ApiData): Vo2Point[] {
  const byDate = new Map<string, { run: number | null; bike: number | null }>();
  for (const c of data.cardio) {
    if (c.vo2_max == null) continue;
    const k = cType(c.type);
    if (k !== "run" && k !== "bike") continue;
    const entry = byDate.get(c.date) || { run: null, bike: null };
    // Keep the highest reading for the day (Garmin sometimes records multiple)
    const prev = entry[k];
    if (prev == null || c.vo2_max > prev) entry[k] = c.vo2_max;
    byDate.set(c.date, entry);
  }

  const sorted = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Carry forward last-known value per sport so areas render continuously.
  let lastRun: number | null = null;
  let lastBike: number | null = null;
  return sorted.map((p) => {
    if (p.run != null) lastRun = p.run; else p.run = lastRun;
    if (p.bike != null) lastBike = p.bike; else p.bike = lastBike;
    return p;
  });
}

export function computeFitnessCurve(data: ApiData, numDays: number): FitnessPoint[] {
  const today = new Date();
  const points: FitnessPoint[] = [];
  let ctl = 0, atl = 0;
  for (let i = numDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const ds = toDS(d);
    let dayLoad = 0;
    for (const c of data.cardio.filter((x) => x.date === ds)) dayLoad += estimateLoad(c.avg_hr, c.duration);
    for (const w of data.workouts.filter((x) => x.date === ds)) dayLoad += Math.round((w.duration_minutes || 0) * 0.8);
    ctl = ctl + (dayLoad - ctl) / 42;
    atl = atl + (dayLoad - atl) / 7;
    points.push({
      date: ds,
      load: dayLoad,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }
  return points;
}

export function weekNumberFor(monday: Date): number {
  const thu = addDays(monday, 3);
  const yearStart = new Date(thu.getFullYear(), 0, 1);
  return Math.ceil(((thu.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
}
