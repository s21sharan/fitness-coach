/**
 * Workout "contract" — structured steps for coach-generated sessions.
 * Designed so we can later emit Garmin FIT / Training API payloads from `steps`
 * (durations, repeats, HR zones, pace targets) without re-parsing free text.
 */

export type WorkoutContractSport = "run" | "bike" | "swim" | "strength" | "other";

export type ContractStepType =
  | "warmup"
  | "work"
  | "recovery"
  | "cooldown"
  | "rest"
  | "repeat";

export interface ContractStep {
  type: ContractStepType;
  /** Human-readable line for UI / Garmin name fields */
  label?: string;
  duration_sec?: number;
  distance_m?: number;
  /** Garmin-style HR zone 1–5 when intensity is zone-based */
  target_hr_zone?: 1 | 2 | 3 | 4 | 5;
  /** Pace in seconds per km (running) */
  pace_sec_per_km?: number;
  /** Optional % FTP for bike structured workouts */
  ftp_percent?: number;
  /** Strength specifics — all optional. Coach may emit any subset. */
  exercise_name?: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  rpe?: number;
  /** Nested steps when type === "repeat" */
  repeats?: number;
  steps?: ContractStep[];
}

export interface WorkoutContractV1 {
  version: 1;
  sport: WorkoutContractSport;
  /** Short title for device / calendar */
  name: string;
  slot?: "am" | "pm" | "full";
  source: "onboarding_preview" | "coach" | "heuristic" | "model";
  steps: ContractStep[];
}

export interface PlannedWorkoutTargets {
  contract?: WorkoutContractV1 | null;
  target_distance_km?: number | null;
  target_duration_min?: number | null;
  target_pace_min_km?: number | null;
  target_hr_zone?: number | null;
  target_hr_max?: number | null;
  muscle_focus?: string | null;
}

export function inferWorkoutSport(text: string): WorkoutContractSport {
  const s = text.toLowerCase();
  if (/swim|pool|css|drill/i.test(s)) return "swim";
  if (/bike|ride|cycling|trainer|zwift/i.test(s)) return "bike";
  if (/lift|squat|dead|bench|push|pull|leg|upper|lower|strength|hypertrophy|gym/i.test(s)) return "strength";
  if (/run|jog|mile|tempo|threshold|interval|track|easy run|long run|marathon/i.test(s)) return "run";
  return "strength";
}

function looksLikeIntervals(text: string): boolean {
  return /\b(\d+)\s*x\s*|\binterval|repeat|track|400|800|1k|km\s*rep|vo2|threshold\b/i.test(text);
}

function looksLikeLongEndurance(text: string, sport: WorkoutContractSport): boolean {
  if (sport !== "run" && sport !== "bike") return false;
  return /\blong\b|easy\s+run|zone\s*2|z2|aerobic|base\b/i.test(text);
}

export function estimateDurationMin(steps: ContractStep[]): number {
  function walk(list: ContractStep[]): number {
    let sec = 0;
    for (const st of list) {
      if (st.type === "repeat" && st.steps && st.repeats) {
        sec += st.repeats * walk(st.steps);
      } else {
        sec += st.duration_sec ?? 0;
        if (st.distance_m && st.pace_sec_per_km) {
          sec += (st.distance_m / 1000) * st.pace_sec_per_km;
        }
      }
    }
    return sec;
  }
  return Math.max(1, Math.round(walk(steps) / 60));
}

/**
 * Build a v1 contract + summary targets from a coach session label (and optional rationale).
 */
export function buildWorkoutContractFromSessionText(
  sessionText: string | null,
  opts: { slot?: "am" | "pm" | "full"; source?: WorkoutContractV1["source"] } = {}
): PlannedWorkoutTargets | null {
  if (!sessionText || !sessionText.trim()) return null;
  const raw = sessionText.trim();
  if (/^rest$/i.test(raw) || /^off$/i.test(raw)) return null;

  const sport = inferWorkoutSport(raw);
  const source = opts.source ?? "heuristic";
  const slot = opts.slot;

  let steps: ContractStep[];
  let name = raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;

  if (sport === "strength") {
    steps = [
      { type: "warmup", label: "Warm-up", duration_sec: 600, target_hr_zone: 2 },
      { type: "work", label: raw, duration_sec: 2700, target_hr_zone: 3 },
      { type: "cooldown", label: "Cool-down / mobility", duration_sec: 600, target_hr_zone: 2 },
    ];
  } else if (looksLikeIntervals(raw)) {
    const workSec = sport === "run" ? 240 : 300;
    const recSec = sport === "run" ? 90 : 120;
    steps = [
      { type: "warmup", label: "Easy warm-up", duration_sec: 600, target_hr_zone: 2 },
      {
        type: "repeat",
        label: "Main set",
        repeats: 6,
        steps: [
          {
            type: "work",
            label: "Interval",
            duration_sec: workSec,
            target_hr_zone: 4,
            pace_sec_per_km: sport === "run" ? 300 : undefined,
          },
          { type: "recovery", label: "Recovery jog / spin", duration_sec: recSec, target_hr_zone: 1 },
        ],
      },
      { type: "cooldown", label: "Cool-down", duration_sec: 600, target_hr_zone: 2 },
    ];
    name = `${sport === "bike" ? "Bike" : "Run"} intervals`;
  } else if (looksLikeLongEndurance(raw, sport)) {
    steps = [
      { type: "warmup", label: "Easy start", duration_sec: 600, target_hr_zone: 2 },
      { type: "work", label: raw, duration_sec: sport === "run" ? 3600 : 5400, target_hr_zone: 2 },
      { type: "cooldown", label: "Easy finish", duration_sec: 600, target_hr_zone: 2 },
    ];
  } else {
    // Default structured endurance / mixed
    steps = [
      { type: "warmup", label: "Warm-up", duration_sec: 600, target_hr_zone: 2 },
      { type: "work", label: raw, duration_sec: 2400, target_hr_zone: 3 },
      { type: "cooldown", label: "Cool-down", duration_sec: 600, target_hr_zone: 2 },
    ];
  }

  const contract: WorkoutContractV1 = {
    version: 1,
    sport,
    name,
    slot,
    source,
    steps,
  };

  const target_duration_min = estimateDurationMin(steps);
  const target_hr_zone = 3;
  let target_pace_min_km: number | null = null;
  if (sport === "run") {
    const workStep = steps.flatMap((s) => (s.type === "repeat" && s.steps ? s.steps : [s])).find((x) => x.pace_sec_per_km);
    if (workStep?.pace_sec_per_km) target_pace_min_km = workStep.pace_sec_per_km / 60;
  }

  return {
    contract,
    target_duration_min,
    target_hr_zone,
    target_pace_min_km,
  };
}

/** Compact line for calendar / device names (Garmin upload prep). */
export function formatContractOutline(contract: WorkoutContractV1): string {
  const repeat = contract.steps.find((s) => s.type === "repeat");
  if (repeat?.repeats && repeat.steps && repeat.steps.length > 0) {
    const w = repeat.steps.find((x) => x.type === "work");
    const r = repeat.steps.find((x) => x.type === "recovery");
    const wz = w?.target_hr_zone != null ? `Z${w.target_hr_zone}` : "work";
    const rz = r?.target_hr_zone != null ? `Z${r.target_hr_zone}` : "rec";
    return `${repeat.repeats}× ${wz} / ${rz}`;
  }
  const work = contract.steps.find((s) => s.type === "work");
  if (work?.label) {
    const t = work.label;
    return t.length > 72 ? `${t.slice(0, 69)}…` : t;
  }
  return contract.name;
}
