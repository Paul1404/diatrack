// Standalone DESTRUCTIVE database reset (no src/, no drizzle-kit). Copied into
// the runtime image alongside migrate.mjs. Drops every table, type, and the
// drizzle migration bookkeeping, then re-applies migrations from scratch.
//
// This wipes ALL data. It only runs when CONFIRM_RESET is set to the exact
// value "diatrack" so it can never fire by accident (e.g. a stray preDeploy).
//
// Run once from the Railway console:
//   CONFIRM_RESET=diatrack node reset.mjs
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[reset] DATABASE_URL is not set");
  process.exit(1);
}

if (process.env.CONFIRM_RESET !== "diatrack") {
  console.error(
    '[reset] refusing to run: set CONFIRM_RESET="diatrack" to confirm wiping ALL data',
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
  console.warn("[reset] dropping public schema and drizzle migration history...");
  // Drop everything in public (tables, enums, indexes) and recreate it empty.
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  // Drizzle records applied migrations in its own schema; clear it so the
  // migrator re-applies 0000 against the now-empty database.
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  console.info("[reset] re-applying migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("[reset] done, database is fresh");
  await pool.end();
} catch (err) {
  console.error("[reset] failed:", err);
  process.exit(1);
}
