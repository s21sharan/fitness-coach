create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  summary text not null,
  data_hash text not null,
  generated_at timestamptz not null default now(),
  unique(user_id, date)
);

create index idx_daily_summaries_user_date on public.daily_summaries(user_id, date);
