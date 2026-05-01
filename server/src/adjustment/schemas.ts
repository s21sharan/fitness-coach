import { z } from "zod";

const adjustmentSchema = z.object({
  type: z.enum(["volume", "frequency", "intensity", "session_swap", "rest_day", "periodization"]),
  description: z.string(),
  affected_days: z.array(z.number().int().min(0).max(6)),
});

const dayLayoutSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  session_type: z.string().min(1),
  ai_notes: z.string().nullable(),
});

export const weeklyAdjustmentSchema = z.object({
  summary: z.string(),
  compliance_pct: z.number().int().min(0).max(100),
  adjustments: z.array(adjustmentSchema),
  risk_flags: z.array(z.string()),
  next_week_layout: z.array(dayLayoutSchema).min(7).max(7),
});

export type WeeklyAdjustment = z.infer<typeof weeklyAdjustmentSchema>;
