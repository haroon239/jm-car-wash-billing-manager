import { requireDatabase } from "../config/database";
import type { SettingsInput } from "../validators/settings.schema";

const fields = `company_name AS "companyName",phone,email,trn,address,
  invoice_prefix AS "invoicePrefix",vat_rate AS "vatRate"`;
export async function getSettings() {
  return (await requireDatabase().query(`SELECT ${fields} FROM company_settings WHERE id=1`))
    .rows[0];
}
export async function saveSettings(input: SettingsInput) {
  return (
    await requireDatabase().query(
      `INSERT INTO company_settings(
        id,company_name,phone,email,trn,address,invoice_prefix,vat_rate
      ) VALUES(1,$1,$2,$3,NULLIF($4,''),$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET company_name=EXCLUDED.company_name,
        phone=EXCLUDED.phone,email=EXCLUDED.email,trn=EXCLUDED.trn,
        address=EXCLUDED.address,invoice_prefix=EXCLUDED.invoice_prefix,
        vat_rate=EXCLUDED.vat_rate,updated_at=NOW()
      RETURNING ${fields}`,
      [
        input.companyName,
        input.phone,
        input.email,
        input.trn,
        input.address,
        input.invoicePrefix,
        input.vatRate,
      ],
    )
  ).rows[0];
}
