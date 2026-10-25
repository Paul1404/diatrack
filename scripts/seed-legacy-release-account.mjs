import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

const url = new URL(process.env.DATABASE_URL);
if (process.env.DIATRACK_RELEASE_TEST !== "1" || url.pathname !== "/diatrack_release" || !["127.0.0.1", "localhost"].includes(url.hostname)) {
  throw new Error("Legacy fixture requires the isolated local release database");
}
const pool = new Pool({ connectionString: url.toString() });
try {
  const hash = await hashPassword("Synthetic-release-fixture-2026!");
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ('legacy-release', 'Legacy release fixture', 'legacy-release@example.invalid')`);
  await pool.query(`INSERT INTO account (id, issuer, account_id, provider_id, user_id, password) VALUES ('legacy-release-account', 'local:credential', 'legacy-release', 'credential', 'legacy-release', $1)`, [hash]);
} finally {
  await pool.end();
}
