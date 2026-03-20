-- Add nickname and notes columns to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes text;
