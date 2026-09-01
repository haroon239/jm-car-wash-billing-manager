ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS room_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS washes_per_cycle INTEGER;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_contract_dates_check;
ALTER TABLE customers
  ADD CONSTRAINT customers_contract_dates_check
  CHECK (contract_end_date IS NULL OR contract_end_date >= plan_start_date);

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_washes_per_cycle_check;
ALTER TABLE customers
  ADD CONSTRAINT customers_washes_per_cycle_check
  CHECK (washes_per_cycle IS NULL OR washes_per_cycle > 0);

CREATE TABLE IF NOT EXISTS wash_records (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
  washed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note VARCHAR(300),
  recorded_by VARCHAR(120) NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wash_records_customer_date_idx
  ON wash_records(customer_id, washed_at DESC);

CREATE TABLE IF NOT EXISTS contract_stops (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  stop_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  full_price NUMERIC(12,2) NOT NULL,
  prorated_amount NUMERIC(12,2) NOT NULL,
  reason VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, stop_date)
);
