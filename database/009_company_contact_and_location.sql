ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS email VARCHAR(160);

UPDATE company_settings
SET company_name = 'JAHAN MUHAMMAD FOR CAR WASHING & CLEANING CO.',
    phone = COALESCE(phone, '+971 52 8843059'),
    email = COALESCE(email, 'jmcarwashandcleaning@gmail.com'),
    updated_at = NOW()
WHERE id = 1;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS building_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS flat_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parking_no VARCHAR(50);
