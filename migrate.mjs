// Standalone production migrator (no src/, no drizzle-kit). Copied into the
// runtime image and run via the Railway preDeployCommand.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
  console.info("[migrate] applying migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.info("[migrate] done");
  await pool.end();
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exit(1);
}
