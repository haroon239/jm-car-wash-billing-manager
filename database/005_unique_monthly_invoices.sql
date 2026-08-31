ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_month DATE;

UPDATE invoices
SET billing_month = DATE_TRUNC('month', issue_date)::DATE
WHERE billing_month IS NULL;

WITH duplicate_map AS (
  SELECT id AS duplicate_id,
    FIRST_VALUE(id) OVER (PARTITION BY customer_id, billing_month ORDER BY id) AS keeper_id,
    ROW_NUMBER() OVER (PARTITION BY customer_id, billing_month ORDER BY id) AS row_number
  FROM invoices
)
UPDATE payments
SET invoice_id = duplicate_map.keeper_id
FROM duplicate_map
WHERE payments.invoice_id = duplicate_map.duplicate_id
  AND duplicate_map.row_number > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY customer_id, billing_month ORDER BY id) AS row_number
  FROM invoices
)
DELETE FROM invoices
USING ranked
WHERE invoices.id = ranked.id AND ranked.row_number > 1;

ALTER TABLE invoices ALTER COLUMN billing_month SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_customer_billing_month_unique
  ON invoices(customer_id, billing_month);
