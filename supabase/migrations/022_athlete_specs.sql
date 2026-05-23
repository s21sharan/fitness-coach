-- ============================================================
-- Migration 022 — Per-athlete coaching constraint spec
--
-- A versioned, append-only record of the hard constraints the
-- coach must satisfy when generating a plan for THIS athlete
-- (e.g. max quality sessions/week, 48h heavy-legs→quality-run
-- spacing, forbidden movement patterns for injuries, swim only
-- on pool-access days). The numbers are authored per athlete by
-- the coach (seeded at onboarding, edited as the situation
-- changes) and hard-checked against every generated plan — they
-- are NOT global rules baked into the app.
--
-- Every mutation (onboarding draft, lazy backfill, coach edit)
-- inserts a NEW row that supersedes the prior one; at most one
-- row per user is 'active'. The justification column records WHY
-- each version exists for audit / rollback / explainability.
-- ============================================================

create table if not exists public.athlete_specs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,

  version integer not null default 1,
  status text not null default 'active' check (status in ('draft','active','superseded','archived')),

  -- Machine-checkable hard constraints (shape: src/lib/training/spec/schema.ts)
  constraints jsonb not null,
  -- Free-text coaching intent (advisory, not hard-enforced)
  notes jsonb not null default '[]'::jsonb,

  -- Why this version exists — required for every mutation
  justification text not null default '',
  source text not null check (source in ('onboarding','backfill','coach_edit','reonboarding')),

  -- Self-FK for the version chain
  supersedes_id uuid references public.athlete_specs(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_athlete_specs_user_status
  on public.athlete_specs(user_id, status);

-- At most one active spec per athlete.
create unique index if not exists idx_athlete_specs_one_active_per_user
  on public.athlete_specs(user_id) where status = 'active';

alter table public.athlete_specs enable row level security;

create policy "Users can manage own athlete specs" on public.athlete_specs
  for all using (user_id = current_setting('app.current_user_id', true));
