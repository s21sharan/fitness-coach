import { supabase } from "../db.js";
import { classifyPlanned } from "./planned-category.js";

// Auto-match incoming sync actuals to scheduled planned workouts on the same
// date. Runs at the end of reconcileUserActivities() so we only ever match
// against the unsuppressed winner of each Garmin↔Strava overlap group.
//
// Rules:
// - Planned must be status='scheduled'. Anything completed/skipped/moved is
//   user-authoritative and stays untouched.
// - Actual must be is_suppressed=false, planned_workout_id IS NULL,
//   unmatched_at IS NULL. unmatched_at is the sticky "user said no, don't
//   re-link" bit.
// - Cardio matches sport-to-sport (run↔run, bike↔bike, swim↔swim). Strength
//   matches any workout_logs row on the date (Hevy doesn't subtype the
//   session further; the user's planned "Upper"/"Lower" label is descriptive
//   not enforced).
// - When multiple candidates exist on the same date, pick the earliest
//   start_time; tiebreak by smallest id. Idempotent on repeated runs.

interface PlannedRow {
  id: string;
  date: string;
  session_type: string;
  targets: Record<string, unknown> | null;
}

interface ActualCandidate {
  table: "workout_logs" | "cardio_logs";
  id: string;
  date: string;
  start_time: string | null;
  type: string | null; // null for workout_logs (implicitly strength)
}

export async function matchPlannedToActuals(
  userId: string,
  range?: { from: string; to: string },
): Promise<void> {
  // Range widens by ±1 day so a session logged at 11:55pm local that lands
  // on the previous UTC date still finds its planned slot. Strict same-date
  // join still applies — we just widen the fetch window.
  const fromDate = range?.from
    ? shiftDate(range.from, -1)
    : null;
  const toDate = range?.to ? shiftDate(range.to, 1) : null;

  // 1. Pull this user's active plan(s) so we can scope planned rows.
  const { data: plans, error: planErr } = await supabase
    .from("training_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");
  if (planErr) throw planErr;
  const planIds = (plans ?? []).map((p: { id: string }) => p.id);
  if (planIds.length === 0) return;

  let plannedQuery = supabase
    .from("planned_workouts")
    .select("id, date, session_type, targets")
    .in("plan_id", planIds)
    .eq("status", "scheduled");
  if (fromDate) plannedQuery = plannedQuery.gte("date", fromDate);
  if (toDate) plannedQuery = plannedQuery.lte("date", toDate);
  const { data: plannedRows, error: plannedErr } = await plannedQuery;
  if (plannedErr) throw plannedErr;
  const planned = (plannedRows ?? []) as PlannedRow[];
  if (planned.length === 0) return;

  // 2. Pull candidate actuals — only un-suppressed, unmatched, never-unlinked.
  let cardioQuery = supabase
    .from("cardio_logs")
    .select("id, date, type, start_time")
    .eq("user_id", userId)
    .eq("is_suppressed", false)
    .is("planned_workout_id", null)
    .is("unmatched_at", null);
  if (fromDate) cardioQuery = cardioQuery.gte("date", fromDate);
  if (toDate) cardioQuery = cardioQuery.lte("date", toDate);
  const { data: cardioRows, error: cardioErr } = await cardioQuery;
  if (cardioErr) throw cardioErr;

  let workoutQuery = supabase
    .from("workout_logs")
    .select("id, date, start_time")
    .eq("user_id", userId)
    .eq("is_suppressed", false)
    .is("planned_workout_id", null)
    .is("unmatched_at", null);
  if (fromDate) workoutQuery = workoutQuery.gte("date", fromDate);
  if (toDate) workoutQuery = workoutQuery.lte("date", toDate);
  const { data: workoutRows, error: workoutErr } = await workoutQuery;
  if (workoutErr) throw workoutErr;

  // 3. Bucket actuals by (date, kind, sport) for O(1) lookup per planned row.
  const cardioByDate = new Map<string, ActualCandidate[]>();
  for (const r of (cardioRows ?? []) as Array<{
    id: string;
    date: string;
    type: string | null;
    start_time: string | null;
  }>) {
    const key = `${r.date}|${(r.type ?? "").toLowerCase()}`;
    if (!cardioByDate.has(key)) cardioByDate.set(key, []);
    cardioByDate.get(key)!.push({
      table: "cardio_logs",
      id: r.id,
      date: r.date,
      start_time: r.start_time,
      type: r.type,
    });
  }
  const workoutByDate = new Map<string, ActualCandidate[]>();
  for (const r of (workoutRows ?? []) as Array<{
    id: string;
    date: string;
    start_time: string | null;
  }>) {
    if (!workoutByDate.has(r.date)) workoutByDate.set(r.date, []);
    workoutByDate.get(r.date)!.push({
      table: "workout_logs",
      id: r.id,
      date: r.date,
      start_time: r.start_time,
      type: null,
    });
  }

  // 4. Greedy first-fit match. Track which actuals are already claimed so two
  // planned rows on the same date don't both pick the same actual.
  const claimed = new Set<string>(); // `${table}:${id}`

  // Stable order: oldest planned date first, then smallest id.
  const sortedPlanned = [...planned].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  for (const p of sortedPlanned) {
    const cat = classifyPlanned(p);
    if (cat.kind === "rest" || cat.kind === "other") continue;

    let candidates: ActualCandidate[] | undefined;
    if (cat.kind === "strength") {
      candidates = workoutByDate.get(p.date);
    } else {
      candidates = cardioByDate.get(`${p.date}|${cat.sport}`);
    }
    if (!candidates || candidates.length === 0) continue;

    // Earliest start_time wins; nulls sort last. Tiebreak by smallest id.
    const sortedCandidates = candidates
      .filter((c) => !claimed.has(`${c.table}:${c.id}`))
      .sort((a, b) => {
        if (a.start_time && b.start_time) {
          if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
        } else if (a.start_time) {
          return -1;
        } else if (b.start_time) {
          return 1;
        }
        return a.id < b.id ? -1 : 1;
      });

    const winner = sortedCandidates[0];
    if (!winner) continue;
    claimed.add(`${winner.table}:${winner.id}`);

    // 5. Write the match — actual gets the back-pointer, planned flips to completed.
    const { error: linkErr } = await supabase
      .from(winner.table)
      .update({ planned_workout_id: p.id })
      .eq("id", winner.id);
    if (linkErr) throw linkErr;

    const { error: statusErr } = await supabase
      .from("planned_workouts")
      .update({ status: "completed" })
      .eq("id", p.id);
    if (statusErr) throw statusErr;
  }
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
