-- Dashboard layout slots (3 per user, named, explicit save)
CREATE TABLE IF NOT EXISTS dashboard_slots (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) NOT NULL,
  slot_index      smallint NOT NULL CHECK (slot_index BETWEEN 0 AND 2),
  name            text NOT NULL DEFAULT 'Slot',
  widgets         jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, slot_index)
);

ALTER TABLE dashboard_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own slots"
  ON dashboard_slots FOR ALL
  USING (auth.uid() = user_id);
