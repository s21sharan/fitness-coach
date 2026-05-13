-- 012_activity_dedup.sql
-- Provider-priority deduplication across cardio_logs and workout_logs.
--
-- Strava-side lifting activities (WeightTraining/Crossfit/Workout) used
-- to land in cardio_logs as type='other', producing duplicates next to
-- Hevy's structured strength rows in workout_logs. The reconciler now
-- detects these overlaps and marks the lower-priority row suppressed.
-- Suppressed rows stay in the table so they can re-surface if the
-- dedicated provider (Hevy) is later disconnected.

-- Allow 'strength' as a cardio_logs.type. Strava strength activities
-- now classify here instead of bucketing into 'other'.
ALTER TABLE public.cardio_logs DROP CONSTRAINT IF EXISTS cardio_logs_type_check;
ALTER TABLE public.cardio_logs
  ADD CONSTRAINT cardio_logs_type_check
  CHECK (type IN ('run', 'bike', 'swim', 'strength', 'other'));

-- Dedup metadata on cardio_logs.
ALTER TABLE public.cardio_logs
  ADD COLUMN IF NOT EXISTS is_suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_by_provider text,
  ADD COLUMN IF NOT EXISTS suppressed_by_external_id text;

-- workout_logs: add provider (always 'hevy' today, but anchored for the
-- registry), start_time (Hevy provides it; we just weren't persisting),
-- and the same suppression columns.
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'hevy',
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS is_suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suppressed_by_provider text,
  ADD COLUMN IF NOT EXISTS suppressed_by_external_id text;

-- Read paths filter heavily on is_suppressed=false; index it next to the
-- existing (user_id, date) ordering for the common scan pattern.
CREATE INDEX IF NOT EXISTS idx_cardio_logs_user_date_active
  ON public.cardio_logs(user_id, date)
  WHERE is_suppressed = false;

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date_active
  ON public.workout_logs(user_id, date)
  WHERE is_suppressed = false;
