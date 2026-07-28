import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "~/server/env";
import { createDatabaseReadiness, isDatabaseWakeError } from "./readiness";
import * as schema from "./schema";

// Single pooled drizzle client. Postgres only (Railway DATABASE_URL).
// Serverless-tuned pool to survive cold starts without exhausting connections.
const pool = new Pool({
  connectionString: getEnv().DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// PostgreSQL may close idle clients when its Railway service sleeps. A pool
// error listener keeps that expected disconnect from becoming an uncaught
// process error; the next request establishes a fresh connection.
pool.on("error", (error) => {
  if (isDatabaseWakeError(error)) {
    console.info("[database] idle connection closed; reconnecting on the next request");
    return;
  }
  console.error("[database] unexpected idle connection error:", error);
});

export const ensureDatabaseReady = createDatabaseReadiness({
  check: () => pool.query("select 1"),
  onWaiting: () => console.info("[database] waiting for PostgreSQL to wake up"),
  onReadyAfterRetry: () => console.info("[database] PostgreSQL is ready"),
});

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type DB = typeof db;
export { DatabaseUnavailableError } from "./readiness";
export { schema };
