import type { CardioLog, WorkoutLog } from "@/lib/hooks/use-dashboard-data";
import type { FitnessPoint } from "@/components/charts/fitness-chart";

// ---------- Race-time prediction (Riegel) ----------

const RIEGEL_K = 1.06;

export interface RacePrediction {
  distanceKm: number;
  label: string;
  predictedSec: number;
  basis: { date: string; distanceKm: number; durationSec: number };
}

const RACE_TARGETS: { km: number; label: string }[] = [
  { km: 5, label: "5K" },
  { km: 10, label: "10K" },
  { km: 21.0975, label: "Half Marathon" },
  { km: 42.195, label: "Marathon" },
];

export function predictRaceTimes(cardio: CardioLog[]): RacePrediction[] {
  const runs = cardio
    .filter((c) => (c.type === "run" || c.type === "trail_running") && c.distance > 1 && c.duration > 60)
    .map((c) => ({ date: c.date, distanceKm: c.distance, durationSec: c.duration }));

  if (runs.length === 0) return [];

  const out: RacePrediction[] = [];
  for (const target of RACE_TARGETS) {
    let best: { sec: number; basis: typeof runs[number] } | null = null;
    for (const r of runs) {
      // Riegel is unreliable far from the base distance — clamp to 0.25x–4x.
      const ratio = r.distanceKm / target.km;
      if (ratio < 0.25 || ratio > 4) continue;
      const predicted = r.durationSec * Math.pow(target.km / r.distanceKm, RIEGEL_K);
      if (!best || predicted < best.sec) best = { sec: predicted, basis: r };
    }
    if (best) {
      out.push({
        distanceKm: target.km,
        label: target.label,
        predictedSec: Math.round(best.sec),
        basis: best.basis,
      });
    }
  }
  return out;
}

export function fmtRaceTime(sec: number): string {
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- e1RM trajectory ----------

export interface E1rmPoint {
  date: string;
  e1rm: number;
}

export interface E1rmSeries {
  liftId: string;
  label: string;
  history: E1rmPoint[];
  projection: E1rmPoint[];
}

const LIFT_PATTERNS: { id: string; label: string; match: (n: string) => boolean }[] = [
  {
    id: "bench",
    label: "Bench Press",
    match: (n) => /bench/i.test(n) && !/(incline|decline|close.?grip|dumbbell|machine)/i.test(n),
  },
  {
    id: "squat",
    label: "Back Squat",
    match: (n) => /squat/i.test(n) && !/(front|goblet|bulgarian|split|hack|leg.press)/i.test(n),
  },
  {
    id: "deadlift",
    label: "Deadlift",
    match: (n) => /deadlift/i.test(n) && !/(romanian|rdl|stiff|sumo|trap|deficit|single|snatch)/i.test(n),
  },
  {
    id: "ohp",
    label: "Overhead Press",
    match: (n) => /(overhead press|military press|\bohp\b|standing press)/i.test(n) && !/(seated|machine|dumbbell|push.?press)/i.test(n),
  },
];

function epleyE1rm(weightKg: number, reps: number): number {
  if (reps < 1 || reps > 12 || weightKg <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

function linearProjection(points: E1rmPoint[], daysAhead: number): E1rmPoint[] {
  if (points.length < 2) return [];
  const t0 = new Date(points[0].date + "T00:00:00").getTime();
  const xs = points.map((p) => (new Date(p.date + "T00:00:00").getTime() - t0) / 86400000);
  const ys = points.map((p) => p.e1rm);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [];
  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  const lastDate = new Date(points[points.length - 1].date + "T00:00:00");
  const lastX = xs[xs.length - 1];
  const out: E1rmPoint[] = [];
  for (let d = 7; d <= daysAhead; d += 7) {
    const x = lastX + d;
    const projected = m * x + b;
    if (projected <= 0) continue;
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + d);
    out.push({
      date: futureDate.toISOString().slice(0, 10),
      e1rm: Math.round(projected * 10) / 10,
    });
  }
  return out;
}

export function computeE1rmTrajectory(workouts: WorkoutLog[], projectDaysAhead: number = 28): E1rmSeries[] {
  const series: E1rmSeries[] = [];

  for (const pattern of LIFT_PATTERNS) {
    const byDate = new Map<string, number>();

    for (const w of workouts) {
      if (!Array.isArray(w.exercises)) continue;
      const exes = w.exercises as Array<{
        name: string;
        sets: Array<{ weight_kg: number; reps: number; type?: string }>;
      }>;
      const matching = exes.filter((e) => pattern.match(e.name));
      if (matching.length === 0) continue;

      let best = 0;
      for (const e of matching) {
        if (!Array.isArray(e.sets)) continue;
        for (const s of e.sets) {
          if (s.type && /warm/i.test(s.type)) continue;
          const e1 = epleyE1rm(s.weight_kg, s.reps);
          if (e1 > best) best = e1;
        }
      }
      if (best > 0) {
        const prev = byDate.get(w.date) ?? 0;
        if (best > prev) byDate.set(w.date, best);
      }
    }

    const history = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm * 10) / 10 }));

    if (history.length < 2) continue;

    // Fit on the last 12 data points to keep the projection responsive to
    // recent trend rather than averaging in ancient noise.
    const fitWindow = history.slice(-12);
    const projection = linearProjection(fitWindow, projectDaysAhead);

    series.push({ liftId: pattern.id, label: pattern.label, history, projection });
  }

  return series;
}

// ---------- Fitness/TSB forecast ----------

export interface FitnessForecast {
  history: FitnessPoint[];
  forecast: FitnessPoint[];
  peakTsbDate: string | null;
  peakTsbValue: number | null;
  notice: string;
}

export function forecastFitness(curve: FitnessPoint[], daysAhead: number = 14): FitnessForecast {
  if (curve.length === 0) {
    return {
      history: [],
      forecast: [],
      peakTsbDate: null,
      peakTsbValue: null,
      notice: "Not enough training data yet for a forecast.",
    };
  }

  const lookback = Math.min(14, curve.length);
  const lastN = curve.slice(-lookback);
  const avgLoad = lastN.reduce((a, p) => a + p.load, 0) / lastN.length;

  let { ctl, atl } = curve[curve.length - 1];
  const lastDate = new Date(curve[curve.length - 1].date + "T00:00:00");
  const forecast: FitnessPoint[] = [];

  for (let d = 1; d <= daysAhead; d++) {
    const date = new Date(lastDate);
    date.setDate(date.getDate() + d);
    ctl = ctl + (avgLoad - ctl) / 42;
    atl = atl + (avgLoad - atl) / 7;
    forecast.push({
      date: date.toISOString().slice(0, 10),
      load: Math.round(avgLoad),
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }

  let peakTsbValue: number | null = null;
  let peakTsbDate: string | null = null;
  for (const p of forecast) {
    if (peakTsbValue === null || p.tsb > peakTsbValue) {
      peakTsbValue = p.tsb;
      peakTsbDate = p.date;
    }
  }

  const currentTsb = curve[curve.length - 1].tsb;
  let notice: string;
  if (peakTsbValue !== null && peakTsbValue > currentTsb + 3) {
    notice = `Form climbs from ${currentTsb} to ~${peakTsbValue} by ${peakTsbDate} if you hold this load.`;
  } else if (peakTsbValue !== null && peakTsbValue < currentTsb - 3) {
    notice = `Holding current load drives form from ${currentTsb} down to ~${peakTsbValue} over the next ${daysAhead} days — building fatigue.`;
  } else {
    notice = `Form holds roughly steady around ${currentTsb} over the next ${daysAhead} days.`;
  }

  return { history: curve, forecast, peakTsbDate, peakTsbValue, notice };
}
