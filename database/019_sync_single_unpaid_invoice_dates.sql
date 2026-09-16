-- Align a customer's only unpaid/unpaid-history-free bill with the edited subscription.
-- Bills with any payment or customers with multiple bills remain immutable history.
UPDATE invoices i
SET issue_date = c.plan_start_date,
    billing_period = c.plan_start_date,
    billing_month = DATE_TRUNC('month', c.plan_start_date)::DATE,
    due_date = COALESCE(c.next_invoice_date, c.plan_start_date),
    subtotal = c.agreed_price,
    total = c.agreed_price,
    description = p.name || ' Car Wash Plan',
    status = CASE
      WHEN COALESCE(c.next_invoice_date, c.plan_start_date) <
           (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE THEN 'overdue'
      ELSE 'pending'
    END,
    sent_at = NULL,
    reminder_sent_at = NULL
FROM customers c
JOIN plans p ON p.id = c.plan_id
WHERE i.customer_id = c.id
  AND (SELECT COUNT(*) FROM invoices all_i WHERE all_i.customer_id = c.id) = 1
  AND COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id), 0) = 0;
