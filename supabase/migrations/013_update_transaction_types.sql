-- Update transaction type check constraint to include new types
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
CHECK (type IN ('buy','sell','dividend','dividend_reinvested','deposit','withdrawal','interest','fee','transfer_in'));
