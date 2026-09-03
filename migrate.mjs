// Standalone production migrator (no src/, no drizzle-kit). Copied into the
// runtime image and run via the Railway preDeployCommand.
//
// Optional destructive reset: set RESET_DB=true in the Railway service
// variables to drop the entire schema and rebuild it from migrations on the
// next deploy. This WIPES ALL DATA (including users). Remove the variable (or
// set it back to false) immediately after the deploy so the next one does not
// wipe again.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const shouldReset = process.env.RESET_DB === "true";

const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
const db = drizzle(pool);

// Railway may still be waking PostgreSQL when the pre-deploy step starts, so
// wait for it (mirrors src/server/db/readiness.ts, which is not in this image).
const WAKE_ERROR_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EPIPE", "ETIMEDOUT",
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01", "57P01", "57P02", "57P03",
]);
const WAKE_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000, 15_000];

function isWakeError(error) {
  if (error instanceof AggregateError) return error.errors.length > 0 && error.errors.every(isWakeError);
  const code = error?.code ?? error?.cause?.code;
  return typeof code === "string" && WAKE_ERROR_CODES.has(code);
}

async function waitForDatabase() {
  for (let attempt = 0; ; attempt++) {
    try {
      await pool.query("select 1");
      if (attempt > 0) console.info("[migrate] PostgreSQL is ready");
      return;
    } catch (error) {
      if (!isWakeError(error) || attempt >= WAKE_RETRY_DELAYS_MS.length) throw error;
      const delay = WAKE_RETRY_DELAYS_MS[attempt];
      console.info(`[migrate] waiting for PostgreSQL to wake up (retry in ${delay}ms)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

try {
  await waitForDatabase();
  if (shouldReset) {
    console.warn(
      "[migrate] RESET_DB=true -> dropping public schema and drizzle history (ALL DATA WILL BE LOST)",
    );
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  }

  console.info("[migrate] applying migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info(shouldReset ? "[migrate] done, database is fresh" : "[migrate] done");
  await pool.end();
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exit(1);
}
