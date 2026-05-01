create table public.weekly_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week_start_date date not null,
  compliance_pct integer default 0,
  avg_calories integer,
  avg_protein integer,
  avg_sleep_hours numeric,
  avg_hrv integer,
  weight_trend jsonb,
  training_volume jsonb,
  ai_summary text,
  adjustments jsonb,
  risk_flags jsonb,
  next_week_layout jsonb,
  user_approved boolean,
  created_at timestamptz not null default now()
);

alter table public.weekly_check_ins enable row level security;

create policy "Users can view own check-ins" on public.weekly_check_ins
  for select using (user_id = current_setting('app.current_user_id', true));

create policy "Users can update own check-ins" on public.weekly_check_ins
  for update using (user_id = current_setting('app.current_user_id', true));

create index idx_weekly_check_ins_user_week on public.weekly_check_ins(user_id, week_start_date);
create index idx_weekly_check_ins_plan on public.weekly_check_ins(plan_id);
