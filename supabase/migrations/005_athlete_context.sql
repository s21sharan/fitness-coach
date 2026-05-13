-- ============================================================
-- Migration 004 — Athlete Context Profile
--
-- Adds normalized tables for the redesigned onboarding flow.
-- Together these capture the "Athlete Context Profile" produced
-- by the 16-screen intake (sports, goals, events, availability,
-- recovery, injuries, equipment, coaching style, AI chat notes).
-- ============================================================

-- ------------------------------------------------------------
-- Extend existing tables
-- ------------------------------------------------------------

alter table public.user_profiles
  add column if not exists athlete_identity text;

alter table public.user_goals
  add column if not exists primary_goal text,
  add column if not exists secondary_goals text[],
  add column if not exists goal_rank text[],
  add column if not exists aggressiveness text;

-- ------------------------------------------------------------
-- Per-sport profile
-- ------------------------------------------------------------

create table if not exists public.athlete_sports (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  sport text not null check (sport in ('run', 'bike', 'swim', 'lift', 'other')),
  enabled boolean not null default true,
  is_planned boolean not null default true,
  priority integer,
  is_primary boolean not null default false,
  is_limiter boolean not null default false,
  current_volume jsonb,
  target_peak jsonb,
  sport_specific jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sport)
);

-- ------------------------------------------------------------
-- Events / races
-- ------------------------------------------------------------

create table if not exists public.athlete_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  sport_type text,
  distance text,
  event_date date,
  priority text check (priority in ('A', 'B', 'C')),
  goal_type text,
  goal_time text,
  course_notes text,
  travel boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Availability
-- ------------------------------------------------------------

create table if not exists public.athlete_availability_windows (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  max_duration_min integer,
  locations text[],
  created_at timestamptz not null default now()
);

create table if not exists public.athlete_availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  rule_key text not null,
  params jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Recovery context
-- ------------------------------------------------------------

create table if not exists public.athlete_recovery (
  user_id text primary key references public.users(id) on delete cascade,
  avg_sleep_hours numeric,
  sleep_consistency text,
  work_stress text,
  physical_job boolean not null default false,
  has_readiness_data boolean not null default false,
  sore_frequency text,
  recovery_confidence text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Injury history
-- ------------------------------------------------------------

create table if not exists public.athlete_injuries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  area text not null,
  current_pain_level integer,
  history boolean not null default true,
  triggers text[],
  affecting_training boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Equipment per sport
-- ------------------------------------------------------------

create table if not exists public.athlete_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  sport text not null,
  item text not null,
  available boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, sport, item)
);

-- ------------------------------------------------------------
-- Body composition + nutrition
-- ------------------------------------------------------------

create table if not exists public.athlete_body_nutrition (
  user_id text primary key references public.users(id) on delete cascade,
  body_goal text,
  goal_weight_lbs numeric,
  target_rate_lbs_per_week numeric,
  diet_style text,
  protein_target_g integer,
  fuel_workouts_when_cutting text,
  tracking_app text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Motivation / preferences / sacrifice + protect rules
-- ------------------------------------------------------------

create table if not exists public.athlete_preferences (
  user_id text primary key references public.users(id) on delete cascade,
  motivation_drivers text[],
  common_derailers text[],
  enjoyed_workouts text[],
  dislikes text[],
  sacrifice_priority text[],
  protect_priority text[],
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Coaching style
-- ------------------------------------------------------------

create table if not exists public.athlete_coach_settings (
  user_id text primary key references public.users(id) on delete cascade,
  aggressiveness text,
  explanation_level text,
  missed_workout_behavior text,
  plan_flexibility text,
  tone_notes text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AI chat notes captured during onboarding
-- ------------------------------------------------------------

create table if not exists public.athlete_chat_notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  insertion_point text not null check (insertion_point in ('goals', 'availability', 'plan_preview', 'coach_style')),
  raw_text text not null,
  extracted jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Derived coaching scores (computed server-side after commit)
-- ------------------------------------------------------------

create table if not exists public.athlete_derived_scores (
  user_id text primary key references public.users(id) on delete cascade,
  training_maturity text,
  ramp_risk text,
  recovery_capacity text,
  goal_conflict text,
  plan_flexibility text,
  interference_score text,
  computed_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Onboarding draft (mid-flow autosave / resume)
-- ------------------------------------------------------------

create table if not exists public.onboarding_drafts (
  user_id text primary key references public.users(id) on delete cascade,
  payload jsonb not null,
  current_step text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.athlete_sports enable row level security;
alter table public.athlete_events enable row level security;
alter table public.athlete_availability_windows enable row level security;
alter table public.athlete_availability_rules enable row level security;
alter table public.athlete_recovery enable row level security;
alter table public.athlete_injuries enable row level security;
alter table public.athlete_equipment enable row level security;
alter table public.athlete_body_nutrition enable row level security;
alter table public.athlete_preferences enable row level security;
alter table public.athlete_coach_settings enable row level security;
alter table public.athlete_chat_notes enable row level security;
alter table public.athlete_derived_scores enable row level security;
alter table public.onboarding_drafts enable row level security;

create policy "Users can manage own athlete sports" on public.athlete_sports
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own events" on public.athlete_events
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own availability windows" on public.athlete_availability_windows
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own availability rules" on public.athlete_availability_rules
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own recovery context" on public.athlete_recovery
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own injuries" on public.athlete_injuries
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own equipment" on public.athlete_equipment
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own body & nutrition" on public.athlete_body_nutrition
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own preferences" on public.athlete_preferences
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own coach settings" on public.athlete_coach_settings
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own chat notes" on public.athlete_chat_notes
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own derived scores" on public.athlete_derived_scores
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own onboarding draft" on public.onboarding_drafts
  for all using (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_athlete_sports_user on public.athlete_sports(user_id);
create index if not exists idx_athlete_events_user_date on public.athlete_events(user_id, event_date);
create index if not exists idx_athlete_availability_windows_user_day on public.athlete_availability_windows(user_id, day_of_week);
create index if not exists idx_athlete_availability_rules_user on public.athlete_availability_rules(user_id);
create index if not exists idx_athlete_injuries_user on public.athlete_injuries(user_id);
create index if not exists idx_athlete_equipment_user_sport on public.athlete_equipment(user_id, sport);
create index if not exists idx_athlete_chat_notes_user_point on public.athlete_chat_notes(user_id, insertion_point);
