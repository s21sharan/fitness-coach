import { supabase } from "../db.js";
import { effectivePriority, type ActivityCategory } from "./providers.js";

// One activity from either cardio_logs or workout_logs, normalised so the
// reconciler can compare them uniformly. The reconciler doesn't care which
// table a row lives in — only which provider produced it, which category
// it falls into, and when it happened.
export interface ActivityRef {
  table: "cardio_logs" | "workout_logs";
  id: string;
  externalId: string;
  // "merged" appears when Garmin has already field-merged into a Strava row.
  provider: string;
  category: ActivityCategory;
  date: string;
  startTime: string | null;
  durationSec: number;
  syncedAt: string;
  isSuppressed: boolean;
  suppressedByProvider: string | null;
  suppressedByExternalId: string | null;
}

// Two activities are the same session if they share category + date and
// their start_times/durations agree within a tolerance. Tolerances are
// loose enough to absorb platform rounding (Hevy commonly logs ~1 min
// longer than Strava for the same lift) but tight enough that two
// separate sessions in the same morning don't collapse together.
//
// Cross-category matching ('other' ↔ a dedicated category) handles legacy
// Strava lifting rows that were classified as 'other' before the strength
// mapping existed. It uses stricter thresholds + requires both start_times
// so a Yoga session + a strength session can't collide.
const SAME_CAT = {
  timeWindowMs: 15 * 60 * 1000,
  durationRatioTol: 0.25,
  durationAbsTolSec: 5 * 60,
};
const CROSS_CAT = {
  timeWindowMs: 10 * 60 * 1000,
  durationRatioTol: 0.15,
  durationAbsTolSec: 3 * 60,
};

function categoryRelation(a: ActivityCategory, b: ActivityCategory):
  | { match: true; cross: boolean }
  | { match: false } {
  if (a === b) return { match: true, cross: false };
  if (a === "other" || b === "other") return { match: true, cross: true };
  return { match: false };
}

export function overlap(a: ActivityRef, b: ActivityRef): boolean {
  if (a.date !== b.date) return false;

  const rel = categoryRelation(a.category, b.category);
  if (!rel.match) return false;
  const tol = rel.cross ? CROSS_CAT : SAME_CAT;

  if (a.startTime && b.startTime) {
    const delta = Math.abs(new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    if (delta > tol.timeWindowMs) return false;
  } else if (rel.cross) {
    // Without a time signal on both sides, a cross-category match is too
    // risky — bail rather than risk collapsing a real "other" activity
    // (e.g. Yoga) into a strength session.
    return false;
  }

  if (a.durationSec > 0 && b.durationSec > 0) {
    const diff = Math.abs(a.durationSec - b.durationSec);
    const maxDur = Math.max(a.durationSec, b.durationSec);
    const ratio = diff / maxDur;
    // Lenient OR: pass if EITHER the absolute diff is small OR the ratio
    // is small. A 60 → 61 min Hevy/Strava pair passes on both counts; a
    // 30 vs 60 min pair fails both and gets rejected.
    if (ratio > tol.durationRatioTol && diff > tol.durationAbsTolSec) return false;
  }

  return true;
}

// A "merged" cardio_logs row carries enrichment from both Strava and Garmin
// in a single record. For priority purposes treat it as whichever of the
// two scores higher under the current active-provider set.
function refPriority(ref: ActivityRef, activeProviders: ReadonlySet<string>): number {
  if (ref.provider === "merged") {
    const strava = effectivePriority("strava", ref.category, activeProviders);
    const garmin = effectivePriority("garmin", ref.category, activeProviders);
    return Math.max(strava, garmin);
  }
  return effectivePriority(ref.provider, ref.category, activeProviders);
}

export interface SuppressionDecision {
  winners: ActivityRef[];
  suppressed: { loser: ActivityRef; winner: ActivityRef }[];
}

// Pure function: given the set of activities and currently-active providers,
// pick one winner per overlap group and produce the suppression edges.
// Exported separately so tests can verify the decision without touching DB.
export function decideSuppression(
  refs: ActivityRef[],
  activeProviders: ReadonlySet<string>,
): SuppressionDecision {
  // Union-find over the overlap relation so transitive groups (A↔B, B↔C)
  // collapse to a single component.
  const parent: number[] = refs.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number): void => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  };

  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (overlap(refs[i], refs[j])) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < refs.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const winners: ActivityRef[] = [];
  const suppressed: { loser: ActivityRef; winner: ActivityRef }[] = [];

  for (const idxs of groups.values()) {
    let best = idxs[0];
    let bestPri = refPriority(refs[best], activeProviders);
    for (let k = 1; k < idxs.length; k++) {
      const idx = idxs[k];
      const pri = refPriority(refs[idx], activeProviders);
      if (pri > bestPri) {
        best = idx;
        bestPri = pri;
        continue;
      }
      if (pri === bestPri) {
        // Tiebreak: most-recently-synced wins, then deterministic by externalId.
        const a = refs[best];
        const b = refs[idx];
        if (b.syncedAt > a.syncedAt || (b.syncedAt === a.syncedAt && b.externalId > a.externalId)) {
          best = idx;
        }
      }
    }
    const winner = refs[best];
    winners.push(winner);
    for (const idx of idxs) {
      if (idx !== best) suppressed.push({ loser: refs[idx], winner });
    }
  }

  return { winners, suppressed };
}

async function fetchActiveProviders(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("integrations")
    .select("provider")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { provider: string }) => r.provider));
}

interface CardioRow {
  id: string;
  activity_id: string | null;
  source: string | null;
  type: string | null;
  date: string;
  start_time: string | null;
  duration: number | null;
  synced_at: string;
  is_suppressed: boolean | null;
  suppressed_by_provider: string | null;
  suppressed_by_external_id: string | null;
}

interface WorkoutRow {
  id: string;
  workout_id: string | null;
  provider: string | null;
  date: string;
  start_time: string | null;
  duration_minutes: number | null;
  synced_at: string;
  is_suppressed: boolean | null;
  suppressed_by_provider: string | null;
  suppressed_by_external_id: string | null;
}

export async function reconcileUserActivities(
  userId: string,
  range?: { from: string; to: string },
): Promise<void> {
  const active = await fetchActiveProviders(userId);

  let cardioQuery = supabase
    .from("cardio_logs")
    .select(
      "id, activity_id, source, type, date, start_time, duration, synced_at, is_suppressed, suppressed_by_provider, suppressed_by_external_id",
    )
    .eq("user_id", userId);
  if (range) cardioQuery = cardioQuery.gte("date", range.from).lte("date", range.to);
  const { data: cardioRows, error: cardioErr } = await cardioQuery;
  if (cardioErr) throw cardioErr;

  let workoutQuery = supabase
    .from("workout_logs")
    .select(
      "id, workout_id, provider, date, start_time, duration_minutes, synced_at, is_suppressed, suppressed_by_provider, suppressed_by_external_id",
    )
    .eq("user_id", userId);
  if (range) workoutQuery = workoutQuery.gte("date", range.from).lte("date", range.to);
  const { data: workoutRows, error: workoutErr } = await workoutQuery;
  if (workoutErr) throw workoutErr;

  const refs: ActivityRef[] = [];
  for (const r of (cardioRows ?? []) as CardioRow[]) {
    refs.push({
      table: "cardio_logs",
      id: r.id,
      externalId: r.activity_id ?? r.id,
      provider: r.source ?? "strava",
      category: (r.type as ActivityCategory) ?? "other",
      date: r.date,
      startTime: r.start_time,
      durationSec: r.duration ?? 0,
      syncedAt: r.synced_at,
      isSuppressed: r.is_suppressed ?? false,
      suppressedByProvider: r.suppressed_by_provider,
      suppressedByExternalId: r.suppressed_by_external_id,
    });
  }
  for (const r of (workoutRows ?? []) as WorkoutRow[]) {
    refs.push({
      table: "workout_logs",
      id: r.id,
      externalId: r.workout_id ?? r.id,
      provider: r.provider ?? "hevy",
      category: "strength",
      date: r.date,
      startTime: r.start_time,
      durationSec: (r.duration_minutes ?? 0) * 60,
      syncedAt: r.synced_at,
      isSuppressed: r.is_suppressed ?? false,
      suppressedByProvider: r.suppressed_by_provider,
      suppressedByExternalId: r.suppressed_by_external_id,
    });
  }

  if (refs.length === 0) return;

  const { winners, suppressed } = decideSuppression(refs, active);

  for (const w of winners) {
    if (!w.isSuppressed && !w.suppressedByProvider && !w.suppressedByExternalId) continue;
    const { error } = await supabase
      .from(w.table)
      .update({ is_suppressed: false, suppressed_by_provider: null, suppressed_by_external_id: null })
      .eq("id", w.id);
    if (error) throw error;
  }

  for (const { loser, winner } of suppressed) {
    if (
      loser.isSuppressed &&
      loser.suppressedByProvider === winner.provider &&
      loser.suppressedByExternalId === winner.externalId
    ) {
      continue;
    }
    const { error } = await supabase
      .from(loser.table)
      .update({
        is_suppressed: true,
        suppressed_by_provider: winner.provider,
        suppressed_by_external_id: winner.externalId,
      })
      .eq("id", loser.id);
    if (error) throw error;
  }
}
