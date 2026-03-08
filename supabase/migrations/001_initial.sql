-- ─────────────────────────────────────────────────────
-- Vanguard — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────

-- LISTS
CREATE TABLE public.lists (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their lists" ON public.lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- TAGS
CREATE TABLE public.tags (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- TASKS
CREATE TABLE public.tasks (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  list_id      UUID REFERENCES public.lists(id) ON DELETE SET NULL,
  priority     TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due          DATE,
  tags         UUID[] DEFAULT '{}',
  notes        TEXT,
  done         BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- Helper: remove a deleted tag from all task tag arrays
CREATE OR REPLACE FUNCTION remove_tag_from_tasks(p_tag_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.tasks
  SET tags = array_remove(tags, p_tag_id)
  WHERE user_id = p_user_id
    AND tags @> ARRAY[p_tag_id];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
