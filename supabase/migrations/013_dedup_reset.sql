-- 013_dedup_reset.sql
-- The first pass of the activity reconciler used overly loose thresholds
-- (60-minute time window, 0.5–2.0 duration ratio) and ended up suppressing
-- legitimately distinct activities — e.g. two separate same-day runs.
-- Reset every row's suppression state so over-suppressed cardio resurfaces,
-- then let the tightened reconciler re-apply on the next sync.

UPDATE public.cardio_logs
SET is_suppressed = false,
    suppressed_by_provider = NULL,
    suppressed_by_external_id = NULL
WHERE is_suppressed = true
   OR suppressed_by_provider IS NOT NULL
   OR suppressed_by_external_id IS NOT NULL;

UPDATE public.workout_logs
SET is_suppressed = false,
    suppressed_by_provider = NULL,
    suppressed_by_external_id = NULL
WHERE is_suppressed = true
   OR suppressed_by_provider IS NOT NULL
   OR suppressed_by_external_id IS NOT NULL;
