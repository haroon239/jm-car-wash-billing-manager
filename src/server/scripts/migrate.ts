import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const sqlPaths = [
  fileURLToPath(new URL("../../../database/001_initial.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/002_customer_plan_start_date.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/003_payments.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/004_company_settings.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/005_unique_monthly_invoices.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/006_invoice_generation_source.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/007_remove_vat.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/008_flexible_billing.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/009_company_contact_and_location.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/010_correct_company_contact.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/011_customer_activity.sql", import.meta.url)),
  fileURLToPath(
    new URL("../../../database/012_partial_payments_and_invoice_notes.sql", import.meta.url),
  ),
  fileURLToPath(new URL("../../../database/013_locations_and_vehicles.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/014_contracts_and_wash_tracking.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/015_online_payment_method.sql", import.meta.url)),
  fileURLToPath(new URL("../../../database/016_payment_reminders.sql", import.meta.url)),
];
async function migrate() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    await client.query("BEGIN");
    for (const sqlPath of sqlPaths) await client.query(await readFile(sqlPath, "utf8"));
    await client.query("COMMIT");
    console.log("Database migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
