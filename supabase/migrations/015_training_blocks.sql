-- 009_training_blocks.sql
-- Training blocks: multi-week periodization units within a plan

create table public.training_blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  block_number integer not null,
  block_type text not null check (block_type in (
    'base', 'build', 'peak', 'taper',
    'accumulation', 'intensification', 'deload'
  )),
  block_label text not null,
  week_count integer not null check (week_count between 1 and 6),
  start_date date not null,
  end_date date not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'completed')),
  generation_context jsonb,
  created_at timestamptz not null default now()
);

-- Add block_id FK to planned_workouts (nullable for backward compat)
alter table public.planned_workouts
  add column block_id uuid references public.training_blocks(id) on delete set null;

-- RLS
alter table public.training_blocks enable row level security;

create policy "Users can manage own blocks" on public.training_blocks
  for all using (
    plan_id in (
      select id from public.training_plans
      where user_id = current_setting('app.current_user_id', true)
    )
  );

-- Indexes
create index idx_training_blocks_plan on public.training_blocks(plan_id, block_number);
create index idx_training_blocks_status on public.training_blocks(plan_id, status);
create index idx_planned_workouts_block on public.planned_workouts(block_id);
