-- ============================================================
-- NATIVE NUTRITION & EXPENDITURE TRACKING
-- Phase 1: schema for foods, food log, weigh-ins, daily expenditure,
-- and rolling TDEE-correction fits. MacroFactor sync remains until
-- the native stack reaches parity (later phase).
-- ============================================================

create extension if not exists pg_trgm;

-- ---------- foods (cached DB entries) ----------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('nutritionix', 'manual', 'custom')),
  source_id text,                       -- nix_item_id for branded; canonical hash for common
  name text not null,
  brand text,
  serving_qty numeric,
  serving_unit text,
  serving_grams numeric,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  sodium numeric,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index idx_foods_name on public.foods using gin (name gin_trgm_ops);

-- ---------- food_log_entries (per-meal entries) ----------
create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  meal_slot text check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id uuid references public.foods(id) on delete set null,
  description text,
  servings numeric not null default 1,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  sodium numeric,
  source text not null check (source in ('search', 'manual', 'quick', 'legacy')),
  created_at timestamptz not null default now()
);

create index idx_food_log_entries_user_time on public.food_log_entries(user_id, logged_at);

-- ---------- weigh_ins (daily body-weight history) ----------
create table public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  weight_lbs numeric not null,
  source text not null check (source in ('manual', 'garmin', 'withings', 'macrofactor')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index idx_weigh_ins_user_date on public.weigh_ins(user_id, date);

-- ---------- expenditure_daily (one row per user-day) ----------
create table public.expenditure_daily (
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  wearable_kcal numeric,                -- Garmin totalKilocalories
  active_kcal numeric,                  -- Garmin activeKilocalories
  bmr_kcal numeric,                     -- Garmin bmrKilocalories (or Mifflin-St Jeor)
  estimated_kcal numeric,               -- BMR * activity factor fallback
  tdee_kcal numeric,                    -- final figure shown to user (after correction_k)
  correction_k numeric,                 -- multiplicative correction applied
  source text not null check (source in ('wearable', 'estimated')),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- tdee_corrections (audit trail of rolling fits) ----------
create table public.tdee_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  computed_at timestamptz not null default now(),
  window_start date not null,
  window_end date not null,
  mean_intake numeric,
  mean_expenditure_raw numeric,
  weight_delta_lbs numeric,
  fitted_k numeric,
  notes text
);

create index idx_tdee_corrections_user_time on public.tdee_corrections(user_id, computed_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.foods enable row level security;
alter table public.food_log_entries enable row level security;
alter table public.weigh_ins enable row level security;
alter table public.expenditure_daily enable row level security;
alter table public.tdee_corrections enable row level security;

-- foods is a shared cache, readable by any signed-in user
create policy "Anyone can read foods" on public.foods
  for select using (true);

create policy "Users can manage own food log" on public.food_log_entries
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own weigh-ins" on public.weigh_ins
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own expenditure" on public.expenditure_daily
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can read own tdee corrections" on public.tdee_corrections
  for all using (user_id = current_setting('app.current_user_id', true));
