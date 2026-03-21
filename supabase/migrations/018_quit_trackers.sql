-- Quit trackers: abstinence/streak tracking
-- Populated by user; displayed in Habits → Quit tab.

create table if not exists public.quit_trackers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.quit_trackers enable row level security;

create policy "Users can manage own quit trackers"
  on public.quit_trackers for all
  using (auth.uid() = user_id);

-- Quit events: each slip/reset (when the streak was broken)
create table if not exists public.quit_events (
  id          uuid primary key default gen_random_uuid(),
  tracker_id  uuid not null references public.quit_trackers(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.quit_events enable row level security;

create policy "Users can manage own quit events"
  on public.quit_events for all
  using (auth.uid() = user_id);
