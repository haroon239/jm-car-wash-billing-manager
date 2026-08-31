ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS agreed_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS auto_invoice BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS next_invoice_date DATE;

UPDATE customers c
SET agreed_price = COALESCE(c.agreed_price, p.price),
    next_invoice_date = COALESCE(c.next_invoice_date, c.plan_start_date + INTERVAL '1 month')
FROM plans p
WHERE p.id = c.plan_id;

ALTER TABLE customers ALTER COLUMN agreed_price SET NOT NULL;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_billing_type_check;
ALTER TABLE customers
  ADD CONSTRAINT customers_billing_type_check
  CHECK (billing_type IN ('monthly', 'weekly', 'one_time', 'manual'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS billing_period DATE,
  ADD COLUMN IF NOT EXISTS description VARCHAR(200),
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0;

UPDATE invoices
SET billing_period = COALESCE(billing_period, issue_date),
    description = COALESCE(description, 'Car Wash Service');

ALTER TABLE invoices ALTER COLUMN billing_period SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN description SET NOT NULL;
DROP INDEX IF EXISTS invoices_customer_billing_month_unique;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_customer_billing_period_unique
  ON invoices(customer_id, billing_period);

CREATE TABLE IF NOT EXISTS invoice_revisions (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  old_description VARCHAR(200) NOT NULL,
  new_description VARCHAR(200) NOT NULL,
  old_total NUMERIC(12,2) NOT NULL,
  new_total NUMERIC(12,2) NOT NULL,
  old_issue_date DATE NOT NULL,
  new_issue_date DATE NOT NULL,
  old_due_date DATE NOT NULL,
  new_due_date DATE NOT NULL,
  reason VARCHAR(300) NOT NULL,
  changed_by VARCHAR(120) NOT NULL DEFAULT 'Admin',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
