-- Notes: short-form scratchpad pages (one active at a time)
-- archived_at IS NULL = current active note

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.notes enable row level security;

create policy "Users can manage own notes"
  on public.notes for all
  using (auth.uid() = user_id);

create index if not exists notes_user_active_idx
  on public.notes (user_id, archived_at)
  where archived_at is null;
