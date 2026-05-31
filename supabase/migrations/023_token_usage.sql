-- Token usage tracking for AI features
create table if not exists token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(clerk_id) on delete cascade,
  source text not null, -- 'chat', 'insights', 'daily_summary', 'plan_regenerate', 'title_gen'
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

-- Index for monthly aggregation queries
create index idx_token_usage_user_month on token_usage (user_id, created_at);

-- RLS
alter table token_usage enable row level security;

create policy "Users can read own usage" on token_usage
  for select using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
