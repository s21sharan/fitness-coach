-- Enable pgvector for future RAG knowledge base
create extension if not exists vector;

-- ============================================================
-- USERS & PROFILES
-- ============================================================

create table public.users (
  id text primary key,                  -- Clerk user ID
  email text not null,
  created_at timestamptz not null default now(),
  onboarding_completed boolean not null default false
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  height numeric,                       -- cm
  weight numeric,                       -- lbs (user's preferred unit)
  age integer,
  sex text check (sex in ('M', 'F', 'Other')),
  activity_level numeric,
  training_experience text check (training_experience in ('beginner', 'intermediate', 'advanced')),
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  body_goal text not null check (body_goal in ('gain_muscle', 'lose_weight', 'maintain', 'other')),
  body_goal_other text,
  emphasis text check (emphasis in ('shoulders', 'chest', 'back', 'arms', 'legs', 'glutes', 'none')),
  training_for_race boolean not null default false,
  race_type text check (race_type in (
    '5k', '10k', 'half_marathon', 'marathon', 'ultra',
    'sprint_tri', 'olympic_tri', 'half_ironman', 'ironman', 'other'
  )),
  race_type_other text,
  race_date date,
  goal_time text,
  does_cardio boolean not null default false,
  cardio_types text[],
  days_per_week integer not null default 4 check (days_per_week between 3 and 7),
  lifting_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- ============================================================
-- INTEGRATIONS
-- ============================================================

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null check (provider in (
    'macrofactor', 'hevy', 'strava', 'garmin', 'google_calendar'
  )),
  access_token text,
  refresh_token text,
  provider_user_id text,
  credentials jsonb,
  last_synced_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

-- ============================================================
-- SYNCED DATA
-- ============================================================

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  fiber numeric,
  sugar numeric,
  sodium numeric,
  meals jsonb,
  synced_at timestamptz not null default now(),
  unique(user_id, date)
);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  workout_id text,
  name text,
  duration_minutes integer,
  exercises jsonb,
  synced_at timestamptz not null default now(),
  unique(user_id, workout_id)
);

create table public.cardio_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  activity_id text,
  type text check (type in ('run', 'bike', 'swim', 'other')),
  distance numeric,
  duration integer,
  avg_hr integer,
  calories numeric,
  pace_or_speed numeric,
  elevation numeric,
  synced_at timestamptz not null default now(),
  unique(user_id, activity_id)
);

create table public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  resting_hr integer,
  hrv integer,
  sleep_hours numeric,
  sleep_score integer,
  body_battery integer,
  stress_level integer,
  steps integer,
  synced_at timestamptz not null default now(),
  unique(user_id, date)
);

-- ============================================================
-- TRAINING PLANS
-- ============================================================

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  split_type text not null check (split_type in (
    'full_body', 'upper_lower', 'ppl', 'arnold', 'phul',
    'bro_split', 'hybrid_upper_lower', 'hybrid_nick_bare'
  )),
  body_goal text,
  race_type text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  plan_config jsonb,
  last_adjusted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  date date not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  session_type text not null,
  ai_notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'skipped', 'moved')),
  calendar_event_id text,
  approved boolean not null default false,
  synced_at timestamptz
);

-- ============================================================
-- CHAT
-- ============================================================

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEEKLY CHECK-INS
-- ============================================================

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  week_start_date date not null,
  weight_trend numeric,
  avg_calories numeric,
  training_volume numeric,
  training_compliance numeric,
  ai_summary text,
  plan_adjustments jsonb,
  user_approved boolean,
  created_at timestamptz not null default now(),
  unique(user_id, week_start_date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.integrations enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.workout_logs enable row level security;
alter table public.cardio_logs enable row level security;
alter table public.recovery_logs enable row level security;
alter table public.training_plans enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.weekly_checkins enable row level security;

create policy "Users can view own data" on public.users
  for select using (id = current_setting('app.current_user_id', true));
create policy "Users can update own data" on public.users
  for update using (id = current_setting('app.current_user_id', true));

create policy "Users can manage own profile" on public.user_profiles
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own goals" on public.user_goals
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own integrations" on public.integrations
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own nutrition" on public.nutrition_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own workouts" on public.workout_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own cardio" on public.cardio_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can view own recovery" on public.recovery_logs
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own plans" on public.training_plans
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own planned workouts" on public.planned_workouts
  for all using (
    plan_id in (
      select id from public.training_plans
      where user_id = current_setting('app.current_user_id', true)
    )
  );

create policy "Users can manage own conversations" on public.chat_conversations
  for all using (user_id = current_setting('app.current_user_id', true));

create policy "Users can manage own messages" on public.chat_messages
  for all using (
    conversation_id in (
      select id from public.chat_conversations
      where user_id = current_setting('app.current_user_id', true)
    )
  );

create policy "Users can manage own checkins" on public.weekly_checkins
  for all using (user_id = current_setting('app.current_user_id', true));

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_nutrition_logs_user_date on public.nutrition_logs(user_id, date);
create index idx_workout_logs_user_date on public.workout_logs(user_id, date);
create index idx_cardio_logs_user_date on public.cardio_logs(user_id, date);
create index idx_recovery_logs_user_date on public.recovery_logs(user_id, date);
create index idx_planned_workouts_plan_date on public.planned_workouts(plan_id, date);
create index idx_chat_messages_conversation on public.chat_messages(conversation_id, created_at);
create index idx_weekly_checkins_user_week on public.weekly_checkins(user_id, week_start_date);
