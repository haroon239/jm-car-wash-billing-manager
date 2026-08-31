CREATE TABLE IF NOT EXISTS customer_activities (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(160) NOT NULL,
  details TEXT,
  actor VARCHAR(120) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_activities_customer_created_idx
  ON customer_activities(customer_id, created_at DESC);

INSERT INTO customer_activities (customer_id, activity_type, title, details, created_at)
SELECT c.id, 'customer_created', 'Customer added',
  'Customer account created and subscription started.', c.created_at
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM customer_activities a
  WHERE a.customer_id = c.id AND a.activity_type = 'customer_created'
);

INSERT INTO customer_activities (
  customer_id, activity_type, title, details, created_at
)
SELECT i.customer_id, 'invoice_generated', 'Invoice generated',
  i.invoice_number || ' generated for AED ' || i.total::TEXT || '.', i.created_at
FROM invoices i
WHERE NOT EXISTS (
  SELECT 1 FROM customer_activities a
  WHERE a.customer_id = i.customer_id
    AND a.activity_type = 'invoice_generated'
    AND a.details LIKE i.invoice_number || '%'
);

INSERT INTO customer_activities (
  customer_id, activity_type, title, details, created_at
)
SELECT i.customer_id, 'payment_received', 'Payment received',
  'AED ' || p.amount::TEXT || ' received for ' || i.invoice_number || '.',
  p.paid_at
FROM payments p
JOIN invoices i ON i.id = p.invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_activities a
  WHERE a.customer_id = i.customer_id
    AND a.activity_type = 'payment_received'
    AND a.created_at = p.paid_at
);
