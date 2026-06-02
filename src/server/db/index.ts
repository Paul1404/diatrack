import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "~/server/env";
import * as schema from "./schema";

// Single pooled drizzle client. Postgres only (Railway DATABASE_URL).
// Serverless-tuned pool to survive cold starts without exhausting connections.
const pool = new Pool({
  connectionString: getEnv().DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
