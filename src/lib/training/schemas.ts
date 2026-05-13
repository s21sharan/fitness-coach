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

export const workoutTargetsSchema = z.object({
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
  am_session: z.string().nullable(),
  am_rationale: z.string().nullable(),
  pm_session: z.string().nullable(),
  pm_rationale: z.string().nullable(),
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
