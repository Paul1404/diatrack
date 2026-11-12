import { pool } from "~/server/db";
import { checkExpiringDevices } from "~/server/scheduler";

// A session-level lock coordinates CronJob retries and manually started jobs.
const client = await pool.connect();
try {
  const result = await client.query<{ acquired: boolean }>(
    "select pg_try_advisory_lock($1, $2) as acquired",
    [1145655627, 1],
  );
  if (result.rows[0]?.acquired) {
    try {
      await checkExpiringDevices();
    } finally {
      await client.query("select pg_advisory_unlock($1, $2)", [1145655627, 1]);
    }
  } else {
    console.info("[scheduler] another reminder job is running");
  }
} catch (error) {
  console.error("[scheduler] reminder job failed", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
