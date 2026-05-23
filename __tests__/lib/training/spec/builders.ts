import type { MultiWeekPlan, SessionContract, SessionDay, WeekBlock, ContractStepZ } from "@/lib/training/schemas";
import { WEEKDAYS, type SpecConstraints, type Weekday } from "@/lib/training/spec/schema";

export function strengthSession(
  name: string,
  exercises: Array<{ name: string; rpe?: number; sets?: number; reps?: number }>,
  slot: "am" | "pm" | "full" = "full",
): SessionContract {
  const steps: ContractStepZ[] = exercises.map((e) => ({
    type: "work",
    exercise_name: e.name,
    sets: e.sets ?? 4,
    reps: e.reps ?? 8,
    rpe: e.rpe ?? null,
  }));
  return {
    sport: "strength",
    name,
    rationale: null,
    contract: { version: 1, sport: "strength", name, slot, source: "coach", steps },
  };
}

export function cardioSession(
  sport: "run" | "bike" | "swim",
  name: string,
  opts: { zone: number; distance_m?: number; duration_sec?: number },
  slot: "am" | "pm" | "full" = "full",
): SessionContract {
  const work: ContractStepZ = {
    type: "work",
    label: name,
    target_hr_zone: opts.zone,
    distance_m: opts.distance_m ?? null,
    duration_sec: opts.duration_sec ?? (opts.distance_m ? null : 3000),
  };
  return {
    sport,
    name,
    rationale: null,
    contract: { version: 1, sport, name, slot, source: "coach", steps: [work] },
  };
}

type DaySpec = { am?: SessionContract; pm?: SessionContract };

export function weekFrom(weekNumber: number, map: Partial<Record<Weekday, DaySpec>>): WeekBlock {
  const days: SessionDay[] = WEEKDAYS.map((label) => {
    const d = map[label];
    const am = d?.am ?? null;
    const pm = d?.pm ?? null;
    return {
      day_label: label,
      am_session: am,
      pm_session: pm,
      is_rest: !am && !pm,
      notes: null,
    };
  });
  return { week_number: weekNumber, week_focus: `Week ${weekNumber}`, days };
}

export function planOf(weeks: WeekBlock[]): MultiWeekPlan {
  return {
    split_type: "hybrid_upper_lower",
    narrative: "test",
    risks: [],
    plan_config: {},
    weeks,
  };
}

export function specOf(overrides: Partial<SpecConstraints> = {}): SpecConstraints {
  return {
    days_per_week: 7,
    lifting_days_per_week: 7,
    max_quality_sessions_per_week: 7,
    min_hours_between_heavy_lower_and_quality_run: 48,
    allow_quality_back_to_back: true,
    max_weekly_volume_increase_pct: null,
    forbidden_movement_patterns: [],
    forbidden_modalities: [],
    required_modality_days: [],
    ...overrides,
  };
}
