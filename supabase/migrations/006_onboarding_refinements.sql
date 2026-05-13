-- ============================================================
-- Onboarding refinements migration
--
-- Additive changes to support the v2 onboarding flow:
--  - availability_windows can carry a session_count (split a block
--    into multiple distinct sessions, e.g. two 60-min PM sessions)
--  - injuries get a free-text description for the specific issue
--    (e.g. body area "foot" + description "plantar fasciitis")
-- ============================================================

ALTER TABLE athlete_availability_windows
  ADD COLUMN IF NOT EXISTS session_count integer DEFAULT 1;

ALTER TABLE athlete_injuries
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE athlete_body_nutrition
  ADD COLUMN IF NOT EXISTS protein_tier text;
