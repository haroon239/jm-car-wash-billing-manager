ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_since DATE;

UPDATE customers c
SET customer_since = COALESCE(
  c.customer_since,
  (SELECT MIN(cc.plan_start_date) FROM customer_contracts cc WHERE cc.customer_id = c.id),
  c.plan_start_date,
  c.created_at::DATE
);

-- Restore the original joining date visible in Awais's customer record before renewal.
UPDATE customers
SET customer_since = DATE '2026-05-16'
WHERE LOWER(name) = 'awais';

ALTER TABLE customers
  ALTER COLUMN customer_since SET NOT NULL;
