/**
 * Derive Jack-Daniels-style training paces (easy, marathon, threshold, 10K,
 * 5K, interval/VO2, repetition) from the athlete's best recent running effort,
 * optionally blended toward a goal race pace as race day approaches.
 *
 * Methodology:
 *   1. Pick the best recent run (highest implied fitness, i.e. lowest Riegel-
 *      projected 5K time) in the lookback window.
 *   2. Project that effort to a 5K-equivalent time via Riegel.
 *   3. If a goal race exists with a known target time + distance, project the
 *      goal to a 5K-equivalent and blend: weight shifts toward goal pace as
 *      weeks-out shrinks, capped so we never overrule actual fitness fully.
 *   4. Apply pace ratios off the blended 5K pace to derive each training pace.
 *
 * Pace ratios are derived from Daniels' Running Formula — the constants are
 * intentionally conservative so generated workouts are achievable.
 */

const RIEGEL_K = 1.06;
const DEFAULT_LOOKBACK_DAYS = 90;
const MIN_DISTANCE_KM = 3;
const MAX_BLEND_TO_GOAL = 0.6; // never give the goal more than 60% weight
const BLEND_HORIZON_WEEKS = 16; // blending starts to kick in inside this window

/**
 * Pace ratios relative to 5K race pace (vVO2max ≈ 5K pace).
 * E.g. easy = 1.27 means easy pace is 27% slower (higher sec/km) than 5K pace.
 */
const RATIOS = {
  easy:       1.27,
  marathon:   1.15,
  threshold:  1.08,
  m10k:       1.04,
  m5k:        1.00,
  interval:   0.97,
  repetition: 0.92,
} as const;

export interface RunRecord {
  date: string;        // YYYY-MM-DD
  distanceKm: number;
  durationSec: number;
}

export interface RaceGoal {
  /** Target race distance in km (e.g. 21.0975 for half marathon). */
  distanceKm: number;
  /** Athlete's goal finishing time in seconds. */
  goalTimeSec: number;
  /** Race date YYYY-MM-DD (used to weight the goal blend). */
  date: string | null;
}

export interface TrainingPaces {
  /** All paces in seconds per kilometer. */
  easy: number;
  marathon: number;
  threshold: number;
  m10k: number;
  m5k: number;
  interval: number;
  repetition: number;
  /** Blended 5K-equivalent time in seconds — the anchor for every pace above. */
  equivalent5kSec: number;
  /** Where the anchor came from, for transparency in the prompt. */
  basis: {
    source: "recent" | "goal" | "blended";
    blendGoalWeight: number; // 0 = pure recent fitness, 1 = pure goal
    recentRun: { date: string; distanceKm: number; paceSecPerKm: number } | null;
    goal: { distanceKm: number; goalTimeSec: number; date: string | null } | null;
  };
}

/** Project a run effort to an equivalent time at a target distance. */
function riegel(durationSec: number, fromKm: number, toKm: number): number {
  return durationSec * Math.pow(toKm / fromKm, RIEGEL_K);
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function isRunType(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return t === "run" || t === "trail_running" || t === "treadmill_running" || t.includes("run");
}

/**
 * Pick the run with the strongest implied fitness in the lookback window.
 * Compare on Riegel-projected 5K time so a fast 3K and a steady 15K are
 * comparable on the same axis.
 */
export function pickBestRecentRun(
  runs: RunRecord[],
  referenceDate: Date = new Date(),
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): RunRecord | null {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  let best: { run: RunRecord; equiv5kSec: number } | null = null;
  for (const r of runs) {
    if (r.distanceKm < MIN_DISTANCE_KM) continue;
    if (r.durationSec <= 0) continue;
    // Riegel is unreliable far from the source distance; clamp to 0.25x–4x of 5K.
    const ratio = r.distanceKm / 5;
    if (ratio < 0.25 || ratio > 4) continue;
    if (parseDate(r.date) < cutoff) continue;

    const equiv5kSec = riegel(r.durationSec, r.distanceKm, 5);
    if (!best || equiv5kSec < best.equiv5kSec) {
      best = { run: r, equiv5kSec };
    }
  }
  return best?.run ?? null;
}

/**
 * Compute the goal-blend weight (0..MAX_BLEND_TO_GOAL).
 * - No race date → 0 (don't blend, we have no time horizon).
 * - Race more than BLEND_HORIZON_WEEKS away → 0 (too far to anchor on goal).
 * - As race approaches, weight ramps linearly to MAX_BLEND_TO_GOAL on race day.
 */
export function computeGoalBlendWeight(
  raceDate: string | null,
  referenceDate: Date = new Date()
): number {
  if (!raceDate) return 0;
  const race = parseDate(raceDate);
  const weeksOut = (race.getTime() - referenceDate.getTime()) / (7 * 86400000);
  if (weeksOut >= BLEND_HORIZON_WEEKS) return 0;
  if (weeksOut <= 0) return MAX_BLEND_TO_GOAL;
  return MAX_BLEND_TO_GOAL * (1 - weeksOut / BLEND_HORIZON_WEEKS);
}

/**
 * Main entry point. Returns null if no usable run is available *and* no goal
 * is provided — without either we have nothing to anchor paces on.
 */
export function deriveTrainingPaces(
  runs: RunRecord[],
  goal: RaceGoal | null = null,
  referenceDate: Date = new Date()
): TrainingPaces | null {
  const bestRun = pickBestRecentRun(runs, referenceDate);

  let recent5kSec: number | null = null;
  if (bestRun) recent5kSec = riegel(bestRun.durationSec, bestRun.distanceKm, 5);

  let goal5kSec: number | null = null;
  if (goal && goal.distanceKm > 0 && goal.goalTimeSec > 0) {
    goal5kSec = riegel(goal.goalTimeSec, goal.distanceKm, 5);
  }

  if (recent5kSec === null && goal5kSec === null) return null;

  let anchor5kSec: number;
  let source: TrainingPaces["basis"]["source"];
  let blendWeight = 0;

  if (recent5kSec !== null && goal5kSec !== null) {
    blendWeight = computeGoalBlendWeight(goal?.date ?? null, referenceDate);
    anchor5kSec = recent5kSec * (1 - blendWeight) + goal5kSec * blendWeight;
    source = blendWeight > 0 ? "blended" : "recent";
  } else if (recent5kSec !== null) {
    anchor5kSec = recent5kSec;
    source = "recent";
  } else {
    anchor5kSec = goal5kSec as number;
    source = "goal";
    blendWeight = 1;
  }

  const anchorPaceSecPerKm = anchor5kSec / 5;
  const round = (n: number) => Math.round(n);

  return {
    easy:       round(anchorPaceSecPerKm * RATIOS.easy),
    marathon:   round(anchorPaceSecPerKm * RATIOS.marathon),
    threshold:  round(anchorPaceSecPerKm * RATIOS.threshold),
    m10k:       round(anchorPaceSecPerKm * RATIOS.m10k),
    m5k:        round(anchorPaceSecPerKm * RATIOS.m5k),
    interval:   round(anchorPaceSecPerKm * RATIOS.interval),
    repetition: round(anchorPaceSecPerKm * RATIOS.repetition),
    equivalent5kSec: Math.round(anchor5kSec),
    basis: {
      source,
      blendGoalWeight: Math.round(blendWeight * 100) / 100,
      recentRun: bestRun
        ? {
            date: bestRun.date,
            distanceKm: bestRun.distanceKm,
            paceSecPerKm: Math.round(bestRun.durationSec / bestRun.distanceKm),
          }
        : null,
      goal: goal
        ? { distanceKm: goal.distanceKm, goalTimeSec: goal.goalTimeSec, date: goal.date }
        : null,
    },
  };
}

/** Format sec/km as `M:SS/km` for prompts and UI. */
export function formatPaceSecPerKm(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

/** Format a duration in seconds as `M:SS` or `H:MM:SS`. */
export function formatTimeSec(sec: number): string {
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Convert a typed cardio log (the dashboard shape) to the minimal RunRecord
 * shape this module consumes. Filters non-runs and missing fields.
 */
export function cardioLogsToRunRecords(
  cardio: Array<{ date: string; type: string; distance: number; duration: number }>
): RunRecord[] {
  const out: RunRecord[] = [];
  for (const c of cardio) {
    if (!isRunType(c.type)) continue;
    if (c.distance <= 0 || c.duration <= 0) continue;
    out.push({ date: c.date, distanceKm: c.distance, durationSec: c.duration });
  }
  return out;
}

/**
 * Map a Trainer race-type string (matching user_goals.race_type values) to a
 * distance in km. Returns null if the race type isn't a fixed-distance run.
 */
export function raceTypeToDistanceKm(raceType: string | null): number | null {
  if (!raceType) return null;
  switch (raceType) {
    case "5k": return 5;
    case "10k": return 10;
    case "half_marathon": return 21.0975;
    case "marathon": return 42.195;
    default: return null;
  }
}

/**
 * Parse a goal_time string like "1:35:00", "1:35", "42:30", or "42:30.5" into
 * seconds. Returns null on unparseable input.
 */
export function parseGoalTimeToSec(goalTime: string | null): number | null {
  if (!goalTime) return null;
  const trimmed = goalTime.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}
