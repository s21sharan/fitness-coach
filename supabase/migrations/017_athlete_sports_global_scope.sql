-- Widen athlete_sports.sport to allow 'global' as a scope value.
--
-- The /api/settings/zones route stores user-level default HR / power zones as
-- a synthetic row with sport='global', alongside sport-specific overrides for
-- 'run' / 'bike'. The original constraint from migration 005 only allowed the
-- physical sports {run, bike, swim, lift, other}, so the upsert was failing
-- with athlete_sports_sport_check.

alter table public.athlete_sports
  drop constraint if exists athlete_sports_sport_check;

alter table public.athlete_sports
  add constraint athlete_sports_sport_check
  check (sport in ('global', 'run', 'bike', 'swim', 'lift', 'other'));
