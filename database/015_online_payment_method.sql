-- Keep historical payment methods intact while allowing the new Online method.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash', 'online', 'card', 'bank_transfer', 'other'));
