-- ── GOALS ──────────────────────────────────────────────────────────────────────

create table if not exists goals (
  id           uuid primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  title        text not null,
  description  text,
  category     text not null default 'Other',
  target_date  date,
  status       text not null default 'active',  -- active | completed | abandoned
  created_at   timestamptz default now()
);

alter table goals enable row level security;
create policy "goals_user" on goals for all using (auth.uid() = user_id);

-- ── GOAL MILESTONES ────────────────────────────────────────────────────────────

create table if not exists goal_milestones (
  id          uuid primary key,
  goal_id     uuid references goals(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  completed   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

alter table goal_milestones enable row level security;
create policy "goal_milestones_user" on goal_milestones for all using (auth.uid() = user_id);
