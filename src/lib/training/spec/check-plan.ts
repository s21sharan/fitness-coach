import type { MultiWeekPlan, SessionContract, ContractStepZ } from "../schemas";
import { WEEKDAYS, type SpecConstraints, type Weekday } from "./schema";
import { classifyMovementPatterns, isLowerBodyExercise } from "./movement";

export interface SpecViolation {
  /** Machine id of the rule that fired. */
  rule: string;
  severity: "blocker" | "warning";
  /** 1-based week number; 0 for plan-wide. */
  week: number;
  day_label?: string;
  /** Human-readable line, fed verbatim into the repair prompt. */
  detail: string;
}

const SLOT_HOUR: Record<"am" | "pm" | "full", number> = { am: 7, pm: 18, full: 12 };
const QUALITY_ZONE = 3; // anything above Zone 2 is "quality"
const HEAVY_RPE = 7; // RPE >= this (or unspecified on a compound) counts as heavy

interface FlatSession {
  week: number;
  dayLabel: Weekday;
  dayIndex: number; // continuous across weeks: (week-1)*7 + weekdayIndex
  slot: "am" | "pm" | "full";
  absHour: number; // dayIndex*24 + slot clock hour
  sport: string;
  session: SessionContract;
}

function* iterSteps(steps: ContractStepZ[], mult = 1): Generator<{ step: ContractStepZ; mult: number }> {
  for (const s of steps) {
    if (s.type === "repeat" && s.steps && s.steps.length) {
      yield* iterSteps(s.steps, mult * (s.repeats ?? 1));
    } else {
      yield { step: s, mult };
    }
  }
}

function hasQualityStep(session: SessionContract): boolean {
  for (const { step } of iterSteps(session.contract.steps)) {
    if (step.type === "work" && step.target_hr_zone != null && step.target_hr_zone >= QUALITY_ZONE) {
      return true;
    }
  }
  return false;
}

function isQualityCardio(s: FlatSession): boolean {
  return (s.sport === "run" || s.sport === "bike" || s.sport === "swim") && hasQualityStep(s.session);
}

function isQualityRun(s: FlatSession): boolean {
  return s.sport === "run" && hasQualityStep(s.session);
}

function isHeavyLower(s: FlatSession): boolean {
  if (s.sport !== "strength") return false;
  for (const { step } of iterSteps(s.session.contract.steps)) {
    if (step.type !== "work" || !step.exercise_name) continue;
    const patterns = classifyMovementPatterns(step.exercise_name);
    const isCompoundLower = patterns.has("loaded_knee_flexion") || patterns.has("heavy_hinge");
    if (!isCompoundLower) continue;
    const heavy = step.rpe == null ? true : step.rpe >= HEAVY_RPE;
    if (heavy) return true;
  }
  return false;
}

function runVolumeMeters(s: FlatSession): number {
  if (s.sport !== "run") return 0;
  let m = 0;
  let sec = 0;
  for (const { step, mult } of iterSteps(s.session.contract.steps)) {
    if (step.type !== "work") continue;
    if (step.distance_m) m += step.distance_m * mult;
    else if (step.duration_sec) sec += step.duration_sec * mult;
  }
  // Fall back to time when distance isn't given (≈ proxy for volume comparison).
  return m > 0 ? m : sec;
}

function flatten(plan: MultiWeekPlan): FlatSession[] {
  const out: FlatSession[] = [];
  for (const wk of plan.weeks) {
    for (const day of wk.days) {
      const weekdayIndex = WEEKDAYS.indexOf(day.day_label as Weekday);
      if (weekdayIndex < 0) continue;
      const dayIndex = (wk.week_number - 1) * 7 + weekdayIndex;
      const add = (session: SessionContract | null, pos: "am" | "pm") => {
        if (!session) return;
        const slot = (session.contract.slot ?? pos) as "am" | "pm" | "full";
        out.push({
          week: wk.week_number,
          dayLabel: day.day_label as Weekday,
          dayIndex,
          slot,
          absHour: dayIndex * 24 + SLOT_HOUR[slot],
          sport: session.sport,
          session,
        });
      };
      add(day.am_session, "am");
      add(day.pm_session, "pm");
    }
  }
  return out;
}

/**
 * Hard check #2: does a generated plan obey the athlete's spec?
 *
 * Returns every violation found. Blockers must be fixed before a plan ships;
 * warnings (currently only the fuzzy volume-ramp check) are advisory. The gap
 * check computes *real clock hours* between sessions from AM/PM slots, so a
 * "Mon PM heavy legs → Tue AM threshold" split (which looks like two different
 * days) is correctly flagged as a ~13h gap.
 */
export function checkPlanAgainstSpec(plan: MultiWeekPlan, spec: SpecConstraints): SpecViolation[] {
  const sessions = flatten(plan);
  const violations: SpecViolation[] = [];

  // ── Per-week counts: training days, lifting days, quality sessions ──
  for (const wk of plan.weeks) {
    const inWeek = sessions.filter((s) => s.week === wk.week_number);
    const trainingDays = new Set(inWeek.map((s) => s.dayLabel)).size;
    if (trainingDays > spec.days_per_week) {
      violations.push({
        rule: "days_per_week",
        severity: "blocker",
        week: wk.week_number,
        detail: `Week ${wk.week_number} has ${trainingDays} training days but the athlete trains at most ${spec.days_per_week}/week.`,
      });
    }

    if (spec.lifting_days_per_week !== null) {
      const liftDays = new Set(inWeek.filter((s) => s.sport === "strength").map((s) => s.dayLabel)).size;
      if (liftDays > spec.lifting_days_per_week) {
        violations.push({
          rule: "lifting_days_per_week",
          severity: "blocker",
          week: wk.week_number,
          detail: `Week ${wk.week_number} has ${liftDays} lifting days but the cap is ${spec.lifting_days_per_week}/week.`,
        });
      }
    }

    const qualityCount = inWeek.filter(isQualityCardio).length;
    if (qualityCount > spec.max_quality_sessions_per_week) {
      violations.push({
        rule: "max_quality_sessions_per_week",
        severity: "blocker",
        week: wk.week_number,
        detail: `Week ${wk.week_number} has ${qualityCount} quality (above Zone 2) cardio sessions but the cap is ${spec.max_quality_sessions_per_week}/week.`,
      });
    }
  }

  // ── Heavy lower → quality run spacing (slot-aware, across weeks) ──
  const heavyLowers = sessions.filter(isHeavyLower);
  const qualityRuns = sessions.filter(isQualityRun);
  for (const hl of heavyLowers) {
    for (const qr of qualityRuns) {
      const gap = qr.absHour - hl.absHour;
      if (gap > 0 && gap < spec.min_hours_between_heavy_lower_and_quality_run) {
        violations.push({
          rule: "min_hours_between_heavy_lower_and_quality_run",
          severity: "blocker",
          week: qr.week,
          day_label: qr.dayLabel,
          detail: `Heavy lower-body lift (${hl.dayLabel} ${hl.slot.toUpperCase()}, "${hl.session.name}") is only ${Math.round(gap)}h before a quality run (${qr.dayLabel} ${qr.slot.toUpperCase()}, "${qr.session.name}"). Needs ≥${spec.min_hours_between_heavy_lower_and_quality_run}h — move the lift earlier or the quality run later.`,
        });
      }
    }
  }

  // ── Quality sessions on consecutive days ──
  if (!spec.allow_quality_back_to_back) {
    const qualityDayIndices = Array.from(new Set(sessions.filter(isQualityCardio).map((s) => s.dayIndex))).sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < qualityDayIndices.length; i++) {
      if (qualityDayIndices[i] - qualityDayIndices[i - 1] === 1) {
        const later = sessions.find((s) => s.dayIndex === qualityDayIndices[i] && isQualityCardio(s));
        violations.push({
          rule: "allow_quality_back_to_back",
          severity: "blocker",
          week: later?.week ?? 0,
          day_label: later?.dayLabel,
          detail: `Two quality sessions fall on consecutive days (${sessions.find((s) => s.dayIndex === qualityDayIndices[i - 1])?.dayLabel} → ${later?.dayLabel}). Insert an easy day or rest between them.`,
        });
      }
    }
  }

  // ── Forbidden modalities ──
  if (spec.forbidden_modalities.length > 0) {
    for (const s of sessions) {
      if (spec.forbidden_modalities.includes(s.sport as SpecConstraints["forbidden_modalities"][number])) {
        violations.push({
          rule: "forbidden_modalities",
          severity: "blocker",
          week: s.week,
          day_label: s.dayLabel,
          detail: `${s.dayLabel} has a "${s.sport}" session ("${s.session.name}") but ${s.sport} is forbidden for this athlete.`,
        });
      }
    }
  }

  // ── Forbidden movement patterns (injuries) ──
  if (spec.forbidden_movement_patterns.length > 0) {
    for (const s of sessions) {
      if (s.sport !== "strength") continue;
      for (const { step } of iterSteps(s.session.contract.steps)) {
        if (step.type !== "work" || !step.exercise_name) continue;
        const patterns = classifyMovementPatterns(step.exercise_name);
        const hit = spec.forbidden_movement_patterns.filter((p) => patterns.has(p));
        if (hit.length > 0) {
          violations.push({
            rule: "forbidden_movement_patterns",
            severity: "blocker",
            week: s.week,
            day_label: s.dayLabel,
            detail: `${s.dayLabel} "${s.session.name}" includes "${step.exercise_name}", which loads a forbidden pattern (${hit.join(", ")}). Replace it with a safe alternative.`,
          });
        }
      }
    }
  }

  // ── Required modality-day restrictions ──
  for (const r of spec.required_modality_days) {
    const allowed = new Set(r.days);
    for (const s of sessions) {
      if (s.sport !== r.modality) continue;
      if (!allowed.has(s.dayLabel)) {
        violations.push({
          rule: "required_modality_days",
          severity: "blocker",
          week: s.week,
          day_label: s.dayLabel,
          detail: `${s.dayLabel} has a "${s.sport}" session but ${s.sport} may only be scheduled on ${r.days.join("/")}.`,
        });
      }
    }
  }

  // ── Weekly running-volume ramp (deload-aware, advisory) ──
  if (spec.max_weekly_volume_increase_pct !== null) {
    const sorted = [...plan.weeks].sort((a, b) => a.week_number - b.week_number);
    const vols = sorted.map((wk) =>
      sessions.filter((s) => s.week === wk.week_number).reduce((sum, s) => sum + runVolumeMeters(s), 0),
    );
    const cap = 1 + spec.max_weekly_volume_increase_pct / 100;
    for (let i = 1; i < vols.length; i++) {
      const prev = vols[i - 1];
      const cur = vols[i];
      if (prev <= 0) continue;
      const prevWasDeload = i >= 2 && vols[i - 2] > 0 && prev < vols[i - 2] * 0.85;
      const baseline = prevWasDeload ? vols[i - 2] : prev;
      if (baseline > 0 && cur > baseline * cap) {
        const pct = Math.round((cur / baseline - 1) * 100);
        violations.push({
          rule: "max_weekly_volume_increase_pct",
          severity: "warning",
          week: sorted[i].week_number,
          detail: `Week ${sorted[i].week_number} running volume jumps ~${pct}% over the baseline week, exceeding the ${spec.max_weekly_volume_increase_pct}% cap.`,
        });
      }
    }
  }

  return violations;
}

export function hasBlockers(violations: SpecViolation[]): boolean {
  return violations.some((v) => v.severity === "blocker");
}
