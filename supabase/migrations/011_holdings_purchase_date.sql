-- Add purchase date to holdings for tax lot tracking
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS purchased_at date;
