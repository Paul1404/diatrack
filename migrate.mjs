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

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
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
