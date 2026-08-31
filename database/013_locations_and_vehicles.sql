CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS areas (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id),
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, name)
);

CREATE TABLE IF NOT EXISTS buildings (
  id BIGSERIAL PRIMARY KEY,
  area_id BIGINT NOT NULL REFERENCES areas(id),
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(area_id, name)
);

INSERT INTO properties(name)
VALUES ('Greens & Views')
ON CONFLICT (name) DO NOTHING;

INSERT INTO areas(property_id,name)
SELECT p.id,v.name
FROM properties p
CROSS JOIN (
  VALUES
    ('Al Dhafrah'),('Al Samar'),('Al Thayyal'),('Al Ghozlan'),
    ('Al Arta'),('Al Alka 1 & 3'),('Mosela'),('Panorama'),('Unassigned')
) AS v(name)
WHERE p.name='Greens & Views'
ON CONFLICT (property_id,name) DO NOTHING;

INSERT INTO buildings(area_id,name)
SELECT a.id,v.building_name
FROM areas a
JOIN (
  VALUES
    ('Al Dhafrah','Al Dhafrah 01'),('Al Dhafrah','Al Dhafrah 02'),
    ('Al Dhafrah','Al Dhafrah 03'),('Al Dhafrah','Al Dhafrah 04'),
    ('Al Samar','Al Samar 01'),('Al Samar','Al Samar 02'),
    ('Al Samar','Al Samar 03'),('Al Samar','Al Samar 04'),
    ('Al Thayyal','Al Thayyal 01'),('Al Thayyal','Al Thayyal 02'),
    ('Al Thayyal','Al Thayyal 03'),('Al Thayyal','Al Thayyal 04'),
    ('Al Ghozlan','Al Ghozlan 01'),('Al Ghozlan','Al Ghozlan 02'),
    ('Al Ghozlan','Al Ghozlan 03'),('Al Ghozlan','Al Ghozlan 04'),
    ('Al Arta','Al Arta 01'),('Al Arta','Al Arta 02'),
    ('Al Arta','Al Arta 03'),('Al Arta','Al Arta 04'),
    ('Al Alka 1 & 3','Al Alka 01'),('Al Alka 1 & 3','Al Alka 03'),
    ('Mosela','Mosela'),('Panorama','Panorama')
) AS v(area_name,building_name) ON v.area_name=a.name
ON CONFLICT (area_id,name) DO NOTHING;

INSERT INTO buildings(area_id,name)
SELECT a.id,'Unassigned'
FROM areas a
WHERE a.name='Unassigned'
ON CONFLICT (area_id,name) DO NOTHING;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES areas(id),
  ADD COLUMN IF NOT EXISTS building_id BIGINT REFERENCES buildings(id);

UPDATE customers c
SET area_id=a.id,building_id=b.id
FROM areas a
JOIN buildings b ON b.area_id=a.id AND b.name='Unassigned'
WHERE a.name='Unassigned'
  AND (c.area_id IS NULL OR c.building_id IS NULL);

ALTER TABLE customers ALTER COLUMN area_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN building_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS customers_area_id_idx ON customers(area_id);
CREATE INDEX IF NOT EXISTS customers_building_id_idx ON customers(building_id);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plate_number VARCHAR(40) NOT NULL,
  make_model VARCHAR(120),
  parking_number VARCHAR(50),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vehicles_customer_id_idx ON vehicles(customer_id);

INSERT INTO vehicles(customer_id,plate_number,parking_number,is_primary)
SELECT c.id,c.plate_number,c.parking_no,TRUE
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM vehicles v WHERE v.customer_id=c.id
);
