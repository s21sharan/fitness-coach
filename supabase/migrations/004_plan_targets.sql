-- 004_plan_targets.sql
-- Add targets JSONB column to planned_workouts for AI-generated workout targets
ALTER TABLE public.planned_workouts ADD COLUMN IF NOT EXISTS targets jsonb;

COMMENT ON COLUMN public.planned_workouts.targets IS 'AI-generated workout targets: distance, pace, duration, HR zone, muscle focus';
