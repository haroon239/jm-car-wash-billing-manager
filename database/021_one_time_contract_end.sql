-- Older one-time packages used the service-end date only as their bill date.
-- Promote that date to the contract end so paid advance packages can close and renew.
UPDATE customers c
SET contract_end_date = COALESCE(
      c.next_invoice_date,
      (SELECT MAX(i.due_date) FROM invoices i WHERE i.customer_id=c.id)
    ),
    updated_at = NOW()
WHERE c.billing_type='one_time'
  AND c.contract_end_date IS NULL
  AND COALESCE(
    c.next_invoice_date,
    (SELECT MAX(i.due_date) FROM invoices i WHERE i.customer_id=c.id)
  ) IS NOT NULL;

UPDATE customer_contracts cc
SET contract_end_date=c.contract_end_date
FROM customers c
WHERE cc.customer_id=c.id
  AND cc.status='active'
  AND c.billing_type='one_time'
  AND c.contract_end_date IS NOT NULL;
