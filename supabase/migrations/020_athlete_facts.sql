-- ============================================================
-- Migration 020 — Central Athlete Context: durable fact store
--
-- A lifecycle-managed knowledge layer the coach reads on every
-- chat turn. Facts are extracted from chat messages, completion
-- notes, skip reasons, and plan acceptance signals. Each fact
-- carries a lifecycle (chronic|standing|recent|ephemeral) which
-- determines its TTL. Contradicting beliefs are resolved by
-- inserting a new row that supersedes the old one via
-- supersedes_id — the "graph" is the resulting chain.
-- ============================================================

create table if not exists public.athlete_facts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,

  -- Classification (vocabulary lives in src/lib/athlete-context/vocab.ts)
  category text not null,
  subject text,
  predicate text not null,
  value jsonb,
  summary text not null,

  -- Lifecycle
  lifecycle text not null check (lifecycle in ('chronic','standing','recent','ephemeral')),
  confidence numeric(3,2) not null default 0.8 check (confidence between 0 and 1),
  status text not null default 'active' check (status in ('active','expired','superseded','archived')),

  observed_at timestamptz not null default now(),
  expires_at timestamptz,

  -- Provenance
  source text not null check (source in ('chat','completion_note','skip_note','plan_acceptance','onboarding_recap','manual','derived')),
  source_ref_table text,
  source_ref_id text,

  -- Self-FK for supersedes graph
  supersedes_id uuid references public.athlete_facts(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_athlete_facts_user_status
  on public.athlete_facts(user_id, status);
create index if not exists idx_athlete_facts_user_cat_status
  on public.athlete_facts(user_id, category, status);
create index if not exists idx_athlete_facts_expires_active
  on public.athlete_facts(expires_at) where status = 'active';
create index if not exists idx_athlete_facts_dedupe
  on public.athlete_facts(user_id, category, subject, predicate) where status = 'active';

alter table public.athlete_facts enable row level security;

create policy "Users can manage own athlete facts" on public.athlete_facts
  for all using (user_id = current_setting('app.current_user_id', true));
