-- Payment is due when the billed service cycle completes, not seven days after issue.
UPDATE invoices i
SET due_date = CASE
  WHEN c.billing_type = 'weekly' THEN i.billing_period + 7
  WHEN c.billing_type = 'monthly' THEN MAKE_DATE(
    EXTRACT(YEAR FROM i.billing_period + INTERVAL '1 month')::INTEGER,
    EXTRACT(MONTH FROM i.billing_period + INTERVAL '1 month')::INTEGER,
    LEAST(
      EXTRACT(DAY FROM c.plan_start_date)::INTEGER,
      EXTRACT(DAY FROM (DATE_TRUNC('month', i.billing_period) + INTERVAL '2 month - 1 day'))::INTEGER
    )
  )
  ELSE i.due_date
END
FROM customers c
WHERE c.id = i.customer_id
  AND c.billing_type IN ('monthly', 'weekly');

UPDATE invoices
SET status = CASE
  WHEN status = 'overdue' AND due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE THEN 'pending'
  WHEN status = 'partially_overdue' AND due_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE THEN 'partially_paid'
  ELSE status
END;
