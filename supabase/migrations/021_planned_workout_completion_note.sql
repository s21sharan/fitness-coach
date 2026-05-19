-- ============================================================
-- Migration 021 — Planned workout completion note
--
-- Pairs with athlete_facts (020). When a user marks a session
-- complete and adds reflection text, we store it here and feed
-- it through the fact extractor so the coach sees patterns like
-- "feels strong after deload" or "knee tweak on long runs".
-- skip_reason / skipped_at already exist from migration 019.
-- ============================================================

alter table public.planned_workouts
  add column if not exists completion_note text,
  add column if not exists completed_at timestamptz;
