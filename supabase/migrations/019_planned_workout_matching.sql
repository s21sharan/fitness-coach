-- Planned-workout completion infrastructure.
--
-- Auto-match incoming Strava / Hevy / Garmin activities to scheduled planned
-- sessions on the same date. The reverse FK lives on the actual logs (one
-- planned slot ↔ one actual log) so we can join cheaply on either side and
-- preserve the actual log if the planned session is later deleted.
--
-- unmatched_at is the sticky "user manually unmatched, do not auto-match this
-- actual log again" bit — combined with planned_workout_id IS NULL and
-- planned_workouts.status='scheduled', the matcher is fully idempotent.
--
-- skip_reason captures user-provided context when they skip a planned session.
-- The coach reads this from system-prompt context.

alter table public.workout_logs
  add column planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  add column unmatched_at timestamptz;

alter table public.cardio_logs
  add column planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  add column unmatched_at timestamptz;

alter table public.planned_workouts
  add column skip_reason text,
  add column skipped_at timestamptz;

create index workout_logs_planned_idx on public.workout_logs (planned_workout_id) where planned_workout_id is not null;
create index cardio_logs_planned_idx  on public.cardio_logs  (planned_workout_id) where planned_workout_id is not null;
create index planned_workouts_status_date_idx on public.planned_workouts (status, date);
