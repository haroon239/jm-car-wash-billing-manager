import pg from "pg";
import { env } from "./env";

const globalDatabase = globalThis as typeof globalThis & {
  jmCarWashPool?: pg.Pool;
  jmCarWashPoolErrorHandlerAttached?: boolean;
};

const secureDatabaseUrl = env.databaseUrl.replace(
  /([?&])sslmode=require(?=&|$)/,
  "$1sslmode=verify-full",
);

export const pool = env.databaseUrl
  ? (globalDatabase.jmCarWashPool ??= new pg.Pool({
      connectionString: secureDatabaseUrl,
      max: 3,
      keepAlive: true,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }))
  : null;

if (pool && !globalDatabase.jmCarWashPoolErrorHandlerAttached) {
  pool.on("error", (error: NodeJS.ErrnoException) => {
    console.warn("An idle database connection was reset; the pool will reconnect.", {
      code: error.code ?? "UNKNOWN",
    });
  });
  globalDatabase.jmCarWashPoolErrorHandlerAttached = true;
}

export function requireDatabase() {
  if (!pool) throw Object.assign(new Error("DATABASE_URL is not configured"), { status: 503 });
  return pool;
}

export async function isDatabaseConnected() {
  if (!pool) return false;
  await pool.query("SELECT 1");
  return true;
}
