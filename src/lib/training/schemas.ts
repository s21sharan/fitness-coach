import { z } from "zod";

export const SPLIT_TYPES = [
  "full_body",
  "upper_lower",
  "ppl",
  "arnold",
  "phul",
  "bro_split",
  "hybrid_upper_lower",
  "hybrid_nick_bare",
] as const;

export type SplitType = (typeof SPLIT_TYPES)[number];

// ─── Workout contract (FIT-inspired) ───────────────────────────────

export const CONTRACT_SPORTS = ["run", "bike", "swim", "strength"] as const;
export const CONTRACT_STEP_TYPES = ["warmup", "work", "recovery", "cooldown", "rest", "repeat"] as const;
export const CONTRACT_SOURCES = ["onboarding_preview", "coach", "heuristic", "model"] as const;
export const CONTRACT_SLOTS = ["am", "pm", "full"] as const;

// One level of nesting under `repeat` is enough — deeper recursion confuses generateObject.
const contractStepBaseSchema = z.object({
  type: z.enum(CONTRACT_STEP_TYPES),
  label: z.string().nullable().optional(),
  duration_sec: z.number().int().positive().nullable().optional(),
  distance_m: z.number().positive().nullable().optional(),
  target_hr_zone: z.number().int().min(1).max(5).nullable().optional(),
  pace_sec_per_km: z.number().positive().nullable().optional(),
  ftp_percent: z.number().min(30).max(150).nullable().optional(),
  exercise_name: z.string().nullable().optional(),
  sets: z.number().int().min(1).max(20).nullable().optional(),
  reps: z.number().int().min(1).max(100).nullable().optional(),
  weight_kg: z.number().min(0).max(500).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  repeats: z.number().int().min(1).max(40).nullable().optional(),
});

export const contractStepSchema = contractStepBaseSchema.extend({
  steps: z.array(contractStepBaseSchema).nullable().optional(),
});

export type ContractStepZ = z.infer<typeof contractStepSchema>;

export const workoutContractSchema = z.object({
  version: z.literal(1),
  sport: z.enum(CONTRACT_SPORTS),
  name: z.string().min(1).max(80),
  slot: z.enum(CONTRACT_SLOTS).nullable().optional(),
  source: z.enum(CONTRACT_SOURCES),
  steps: z.array(contractStepSchema).min(1).max(40),
});

export type WorkoutContractZ = z.infer<typeof workoutContractSchema>;

export const sessionContractSchema = z.object({
  sport: z.enum(CONTRACT_SPORTS),
  name: z.string().min(1).max(60),
  rationale: z.string().nullable().optional(),
  contract: workoutContractSchema,
});

export type SessionContract = z.infer<typeof sessionContractSchema>;

// ─── Existing targets schema, extended with `contract` ──────────────

export const workoutTargetsSchema = z.object({
  contract: workoutContractSchema.nullable().optional(),
  target_distance_km: z.number().nullable().optional(),
  target_duration_min: z.number().nullable().optional(),
  target_pace_min_km: z.number().nullable().optional(),
  target_hr_zone: z.number().int().min(1).max(5).nullable().optional(),
  target_hr_max: z.number().int().nullable().optional(),
  muscle_focus: z.string().nullable().optional(),
});

export type WorkoutTargets = z.infer<typeof workoutTargetsSchema>;

export const dayLayoutSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_type: z.string().min(1),
  ai_notes: z.string().nullable(),
  targets: workoutTargetsSchema.optional(),
});

export type DayLayout = z.infer<typeof dayLayoutSchema>;

const planConfigSchema = z.object({
  periodization_phase: z.enum(["base", "build", "peak", "taper"]).optional(),
  race_weeks_out: z.number().int().positive().optional(),
  deload_frequency: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type PlanConfig = z.infer<typeof planConfigSchema>;

export const planGenerationSchema = z.object({
  split_type: z.enum(["full_body", "upper_lower", "ppl", "arnold", "phul", "bro_split", "hybrid_upper_lower", "hybrid_nick_bare"]),
  reasoning: z.string().min(1),
  weekly_layout: z.array(dayLayoutSchema).length(7),
  plan_config: planConfigSchema,
});

export type PlanGeneration = z.infer<typeof planGenerationSchema>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const sessionDaySchema = z.object({
  day_label: z.enum(DAY_LABELS),
  am_session: sessionContractSchema.nullable(),
  pm_session: sessionContractSchema.nullable(),
  is_rest: z.boolean(),
  notes: z.string().nullable(),
});

export type SessionDay = z.infer<typeof sessionDaySchema>;

export const weekBlockSchema = z.object({
  week_number: z.number().int().min(1),
  week_focus: z.string().min(1),
  days: z.array(sessionDaySchema).length(7),
});

export type WeekBlock = z.infer<typeof weekBlockSchema>;

export const multiWeekPlanSchema = z.object({
  split_type: z.enum(SPLIT_TYPES),
  narrative: z.string().min(1),
  risks: z.array(z.string()),
  plan_config: planConfigSchema,
  weeks: z.array(weekBlockSchema).min(1).max(4),
});

export type MultiWeekPlan = z.infer<typeof multiWeekPlanSchema>;
