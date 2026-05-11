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
