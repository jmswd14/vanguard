-- Migrate existing holdings to Transfer In transactions, then drop holdings.
-- Run this once in the Supabase dashboard SQL editor.

INSERT INTO transactions (id, user_id, asset_id, type, symbol, quantity, price, amount, date, notes)
SELECT
  gen_random_uuid(),
  user_id,
  asset_id,
  'transfer_in',
  symbol,
  quantity,
  CASE WHEN quantity > 0 THEN cost_basis / quantity ELSE 0 END,
  cost_basis,
  COALESCE(purchased_at, CURRENT_DATE),
  COALESCE('Migrated from holdings' || CASE WHEN name IS NOT NULL THEN ' — ' || name ELSE '' END, 'Migrated from holdings')
FROM holdings;

DELETE FROM holdings;
