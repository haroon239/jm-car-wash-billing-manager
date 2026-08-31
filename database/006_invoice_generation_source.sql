ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generation_source VARCHAR(20) NOT NULL DEFAULT 'manual';

-- Correct recurring invoices created by the old scheduler after their anniversary.
WITH recurring_dates AS (
  SELECT
    i.id,
    MAKE_DATE(
      EXTRACT(YEAR FROM i.billing_month)::INTEGER,
      EXTRACT(MONTH FROM i.billing_month)::INTEGER,
      LEAST(
        EXTRACT(DAY FROM c.plan_start_date)::INTEGER,
        EXTRACT(
          DAY FROM (DATE_TRUNC('month', i.billing_month) + INTERVAL '1 month - 1 day')
        )::INTEGER
      )
    ) AS anniversary_date
  FROM invoices i
  JOIN customers c ON c.id = i.customer_id
  WHERE c.plan_start_date < i.billing_month
    AND i.status = 'pending'
    AND i.billing_month = DATE_TRUNC(
      'month', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai'
    )::DATE
)
UPDATE invoices i
SET issue_date = recurring_dates.anniversary_date,
    due_date = recurring_dates.anniversary_date + 7,
    generation_source = 'automatic'
FROM recurring_dates
WHERE i.id = recurring_dates.id
  AND i.issue_date > recurring_dates.anniversary_date;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_generation_source_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_generation_source_check
  CHECK (generation_source IN ('manual', 'automatic'));
