CREATE TABLE IF NOT EXISTS company_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name VARCHAR(150) NOT NULL,
  trn VARCHAR(30),
  address TEXT NOT NULL,
  invoice_prefix VARCHAR(12) NOT NULL DEFAULT 'JMCW',
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO company_settings (id, company_name, address)
VALUES (1, 'JM Car Wash', 'United Arab Emirates')
ON CONFLICT (id) DO NOTHING;
