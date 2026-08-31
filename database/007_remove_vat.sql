UPDATE company_settings
SET vat_rate = 0,
    updated_at = NOW()
WHERE id = 1;

UPDATE invoices
SET subtotal = total,
    vat_rate = 0,
    vat_amount = 0
WHERE vat_rate <> 0
   OR vat_amount <> 0
   OR subtotal <> total;
