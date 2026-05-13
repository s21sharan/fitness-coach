-- Physique check-in photos
create table if not exists physique_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  front_url text,
  side_url text,
  back_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table physique_checkins enable row level security;

create policy "Users can read own check-ins"
  on physique_checkins for select
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users can insert own check-ins"
  on physique_checkins for insert
  with check (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
