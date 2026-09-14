ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_group UUID;
CREATE INDEX IF NOT EXISTS payments_group_idx ON payments(payment_group);
