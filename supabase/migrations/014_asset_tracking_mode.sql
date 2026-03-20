-- Add tracking_mode to assets: 'positions' (transactions-based) or 'balance' (manual log)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'balance'
  CHECK (tracking_mode IN ('positions', 'balance'));

-- Migrate existing investment-type accounts to 'positions'
UPDATE assets SET tracking_mode = 'positions'
WHERE type IN ('Brokerage/Investments','Retirement','Health Savings Account (HSA)','Crypto','Business Equity');
