CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  washes_per_month INTEGER,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(160),
  plate_number VARCHAR(40) NOT NULL,
  plan_id BIGINT REFERENCES plans(id),
  plan_start_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  subtotal NUMERIC(12, 2) NOT NULL,
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 5,
  vat_amount NUMERIC(12, 2) NOT NULL,
  total NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  sent_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (name, price, washes_per_month)
VALUES ('Basic', 99, 4), ('Standard', 199, 8), ('Premium', 299, 12), ('Corporate', 1249, NULL)
ON CONFLICT (name) DO NOTHING;
