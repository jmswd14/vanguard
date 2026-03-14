-- ── GREETINGS ─────────────────────────────────────────────────────────────────

create table if not exists public.greetings (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  time_window text not null,   -- overnight, early_morning, morning, midday, afternoon, evening, night, anytime
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.greetings enable row level security;

-- Anyone with the anon key can read (greetings are not user-specific)
create policy "Public read greetings"
  on public.greetings for select
  using (true);

-- ── SEED DATA ─────────────────────────────────────────────────────────────────

insert into public.greetings (text, time_window) values
  -- Overnight (12am–5am)
  ('Burning the midnight oil',       'overnight'),
  ('Still at it?',                   'overnight'),
  ('Night owl hours',                'overnight'),
  ('The world is quiet right now',   'overnight'),
  ('Can''t sleep?',                  'overnight'),
  ('Late night session',             'overnight'),

  -- Early Morning (5am–8am)
  ('Rise and shine',                 'early_morning'),
  ('Early bird',                     'early_morning'),
  ('Up early',                       'early_morning'),
  ('Dawn patrol',                    'early_morning'),
  ('Morning, sunshine',              'early_morning'),
  ('Good morning',                   'early_morning'),

  -- Morning (8am–12pm)
  ('Good morning',                   'morning'),
  ('Morning',                        'morning'),
  ('Top of the morning',             'morning'),
  ('Hope your coffee''s strong',     'morning'),
  ('Ready to take on the day?',      'morning'),
  ('Let''s make today count',        'morning'),

  -- Midday (12pm–2pm)
  ('Good afternoon',                 'midday'),
  ('Lunchtime',                      'midday'),
  ('Midday check-in',                'midday'),
  ('Hope you ate something',         'midday'),
  ('Halfway through the day',        'midday'),

  -- Afternoon (2pm–6pm)
  ('Good afternoon',                 'afternoon'),
  ('Afternoon',                      'afternoon'),
  ('Afternoon already?',             'afternoon'),
  ('Getting through the day',        'afternoon'),
  ('Almost to 5',                    'afternoon'),
  ('Hope the afternoon''s treating you well', 'afternoon'),

  -- Evening (6pm–9pm)
  ('Good evening',                   'evening'),
  ('Evening',                        'evening'),
  ('Hope you had a great day',       'evening'),
  ('Wind-down time',                 'evening'),
  ('How was your day?',              'evening'),
  ('Time to decompress',             'evening'),

  -- Night (9pm–12am)
  ('Getting late',                   'night'),
  ('Almost bedtime',                 'night'),
  ('Winding down?',                  'night'),
  ('One last thing before bed?',     'night'),
  ('Night',                          'night'),
  ('Good night',                     'night'),

  -- Anytime
  ('Howdy, partner',                 'anytime'),
  ('Hey there',                      'anytime'),
  ('Hello, friend',                  'anytime'),
  ('Salutations',                    'anytime'),
  ('What''s good?',                  'anytime'),
  ('Welcome back',                   'anytime'),
  ('Well, hello',                    'anytime'),
  ('Hey, you',                       'anytime');
