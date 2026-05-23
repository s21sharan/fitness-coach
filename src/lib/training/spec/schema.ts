import { z } from "zod";

/**
 * Per-athlete coaching constraint spec.
 *
 * The numbers here are NOT global rules baked into the app — they are authored
 * per athlete by the coach (seeded at onboarding, edited as the athlete's
 * situation changes) and then hard-checked against every generated plan. The
 * enforcement engine is generic; the *values* are athlete-specific. That's what
 * lets one athlete run 3 sub-threshold sessions/week while another is capped at
 * 2, without either limit living in code.
 *
 * Two layers:
 * - `constraints`: structured + machine-checkable. `checkPlanAgainstSpec`
 *   enforces every field here against a generated plan.
 * - `notes`: free-text coaching intent. Injected into the planner's context as
 *   guidance but NOT hard-enforced (no crisp pass/fail).
 */

export const MOVEMENT_PATTERNS = [
  "loaded_knee_flexion", // squat / lunge / split squat / leg press / step-up
  "heavy_hinge", // deadlift / RDL / good morning / hip thrust
  "running_impact", // running / jumping ground-impact
  "jumping_plyometric", // jumps / bounds / plyos
  "overhead_press", // OHP / push press / jerk
  "spinal_loading", // axial-loaded barbell work
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const SPEC_MODALITIES = ["run", "bike", "swim", "strength", "other"] as const;
export type SpecModality = (typeof SPEC_MODALITIES)[number];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const requiredModalityDaysSchema = z.object({
  modality: z.enum(SPEC_MODALITIES),
  /** The session of this modality may ONLY land on these weekdays. */
  days: z.array(z.enum(WEEKDAYS)).min(1),
});
export type RequiredModalityDays = z.infer<typeof requiredModalityDaysSchema>;

export const specConstraintsSchema = z.object({
  /** Availability ceiling — training days per week must not EXCEED this. */
  days_per_week: z.number().int().min(1).max(7),
  /** Strength sessions per week must not exceed this. Null = no lifting cap. */
  lifting_days_per_week: z.number().int().min(0).max(7).nullable(),
  /** Cardio sessions above Zone 2 per week must not exceed this. */
  max_quality_sessions_per_week: z.number().int().min(0).max(7),
  /** Minimum hours between any heavy lower-body lift and a subsequent quality run. */
  min_hours_between_heavy_lower_and_quality_run: z.number().min(0).max(168),
  /** When false, no two consecutive calendar days may both contain a quality session. */
  allow_quality_back_to_back: z.boolean(),
  /**
   * Cap on week-over-week increase in running volume (%). Null = unchecked.
   * Deload weeks (volume drops) are never flagged; the week after a deload is
   * compared to the pre-deload loading week, not the deload trough.
   */
  max_weekly_volume_increase_pct: z.number().min(0).max(100).nullable(),
  /** Movement patterns that must not appear in any strength session (injuries). */
  forbidden_movement_patterns: z.array(z.enum(MOVEMENT_PATTERNS)),
  /** Modalities that must not appear at all (e.g. "run" while a knee heals). */
  forbidden_modalities: z.array(z.enum(SPEC_MODALITIES)),
  /** Day-of-week restrictions per modality (e.g. swim only Tue/Thu — pool access). */
  required_modality_days: z.array(requiredModalityDaysSchema),
});
export type SpecConstraints = z.infer<typeof specConstraintsSchema>;

export const SPEC_SOURCES = ["onboarding", "backfill", "coach_edit", "reonboarding"] as const;
export type SpecSource = (typeof SPEC_SOURCES)[number];

export const SPEC_STATUSES = ["draft", "active", "superseded", "archived"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

/** The model-authored payload (constraints + advisory notes). No DB metadata. */
export const specPayloadSchema = z.object({
  constraints: specConstraintsSchema,
  /** Free-text coaching intent — guidance, not hard-enforced. */
  notes: z.array(z.string()),
});
export type SpecPayload = z.infer<typeof specPayloadSchema>;

/** A persisted, versioned spec row. */
export interface AthleteSpec {
  id: string;
  user_id: string;
  version: number;
  status: SpecStatus;
  constraints: SpecConstraints;
  notes: string[];
  /** Why this version exists — required for every mutation (audit + review). */
  justification: string;
  source: SpecSource;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}
