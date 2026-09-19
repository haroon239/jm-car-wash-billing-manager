import { requireDatabase } from "../config/database";

const backupTables = [
  "company_settings",
  "plans",
  "properties",
  "areas",
  "buildings",
  "customers",
  "customer_contracts",
  "vehicles",
  "invoices",
  "invoice_revisions",
  "payments",
  "wash_records",
  "contract_stops",
  "customer_activities",
] as const;

export async function createFullBackup() {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables: Record<string, unknown[]> = {};
    for (const table of backupTables) {
      tables[table] = (await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    }
    await client.query("COMMIT");
    return {
      format: "jm-car-wash-backup",
      version: 1,
      generatedAt: new Date().toISOString(),
      tableCounts: Object.fromEntries(
        Object.entries(tables).map(([table, rows]) => [table, rows.length]),
      ),
      tables,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
