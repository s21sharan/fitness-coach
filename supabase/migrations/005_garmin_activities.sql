-- 005_garmin_activities.sql
-- Add Garmin activity fields to cardio_logs for enriched data and deduplication
ALTER TABLE public.cardio_logs
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS max_hr integer,
  ADD COLUMN IF NOT EXISTS training_effect_aerobic numeric,
  ADD COLUMN IF NOT EXISTS training_effect_anaerobic numeric,
  ADD COLUMN IF NOT EXISTS vo2_max numeric,
  ADD COLUMN IF NOT EXISTS recovery_time_min integer,
  ADD COLUMN IF NOT EXISTS avg_respiration numeric,
  ADD COLUMN IF NOT EXISTS avg_cadence numeric,
  ADD COLUMN IF NOT EXISTS avg_stride_length numeric,
  ADD COLUMN IF NOT EXISTS ground_contact_time numeric,
  ADD COLUMN IF NOT EXISTS hr_zones jsonb,
  ADD COLUMN IF NOT EXISTS splits jsonb,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'strava';
