-- Stop Contract only ends service. It must not create an extra prorated bill.
-- Remove the known unpaid bill that the old stop flow generated for Awais.
DELETE FROM invoices i
USING customers c
WHERE i.customer_id = c.id
  AND c.name = 'awais'
  AND i.invoice_number = 'JMCW-2026-000020'
  AND i.total = 3.30
  AND i.status = 'pending'
  AND i.customer_note LIKE 'Contract stopped%'
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

UPDATE contract_stops cs
SET prorated_amount = 0
FROM customers c
WHERE cs.customer_id = c.id
  AND c.name = 'awais'
  AND cs.stop_date = DATE '2026-09-16'
  AND cs.prorated_amount = 3.30;
