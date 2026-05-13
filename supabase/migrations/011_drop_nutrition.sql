-- ============================================================
-- DROP NUTRITION TRACKING
-- We're pivoting away from in-app nutrition logging. Tables from
-- 010_native_nutrition.sql and the legacy MacroFactor nutrition_logs
-- table are no longer used.
-- ============================================================

drop table if exists public.tdee_corrections cascade;
drop table if exists public.expenditure_daily cascade;
drop table if exists public.weigh_ins cascade;
drop table if exists public.food_log_entries cascade;
drop table if exists public.foods cascade;
drop table if exists public.nutrition_logs cascade;
