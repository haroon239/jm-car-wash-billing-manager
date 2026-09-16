CREATE TABLE IF NOT EXISTS customer_contracts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id BIGINT REFERENCES plans(id),
  plan_start_date DATE NOT NULL,
  contract_end_date DATE,
  agreed_price NUMERIC(12,2) NOT NULL,
  billing_type VARCHAR(20) NOT NULL,
  washes_per_cycle INTEGER,
  auto_invoice BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active','ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CHECK (contract_end_date IS NULL OR contract_end_date >= plan_start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_contracts_one_active_idx
  ON customer_contracts(customer_id) WHERE status='active';

CREATE INDEX IF NOT EXISTS customer_contracts_history_idx
  ON customer_contracts(customer_id,plan_start_date DESC,id DESC);

INSERT INTO customer_contracts(
  customer_id,plan_id,plan_start_date,contract_end_date,agreed_price,billing_type,
  washes_per_cycle,auto_invoice,status,ended_at
)
SELECT c.id,c.plan_id,c.plan_start_date,c.contract_end_date,c.agreed_price,c.billing_type,
  c.washes_per_cycle,c.auto_invoice,
  CASE WHEN c.contract_end_date IS NOT NULL
    AND c.contract_end_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
    THEN 'ended' ELSE 'active' END,
  CASE WHEN c.contract_end_date IS NOT NULL
    AND c.contract_end_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
    THEN NOW() ELSE NULL END
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM customer_contracts cc WHERE cc.customer_id=c.id);
