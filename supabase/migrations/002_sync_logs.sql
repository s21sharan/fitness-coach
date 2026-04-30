create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('success', 'error')),
  records_synced integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sync_logs enable row level security;

create policy "Users can view own sync logs" on public.sync_logs
  for select using (user_id = current_setting('app.current_user_id', true));

create index idx_sync_logs_user_provider on public.sync_logs(user_id, provider, started_at);
