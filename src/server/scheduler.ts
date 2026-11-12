import { eq } from "drizzle-orm";
import { getAppSettings } from "~/server/app-settings";
import { DatabaseUnavailableError, db, ensureDatabaseReady } from "~/server/db";
import { DEFAULT_USER_SETTINGS, devices, user } from "~/server/db/schema";
import { sendDeviceReminder } from "~/server/email/send";
import { deliverAndRecordReminder } from "~/server/reminder-delivery";
import { dueReminderKeys, sentKeys } from "~/server/reminders";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

/**
 * Check active devices and send expiry reminders. For each active device, send
 * at most one reminder per run for the intervals that have become due, marking
 * every crossed interval as sent. Sent reminders are tracked in
 * devices.remindersSent (comma-separated "{n}h" keys).
 */
export async function checkExpiringDevices(): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await ensureDatabaseReady();
      const settings = await getAppSettings();
      const activeDevices = await db.select().from(devices).where(eq(devices.status, "active"));
      const now = Date.now();
      let failed = false;

      for (const device of activeDevices) {
        const [owner] = await db
          .select({ email: user.email, settings: user.settings })
          .from(user)
          .where(eq(user.id, device.userId))
          .limit(1);
        if (!owner) continue;

        const intervals =
          owner.settings?.reminderIntervalsHours ?? DEFAULT_USER_SETTINGS.reminderIntervalsHours;
        const due = dueReminderKeys(device, intervals, now);
        if (due.length === 0) continue;

        // Multiple intervals can come due at once after downtime; send a single
        // reminder (the email reflects live remaining time) and mark them all.
        const merged = [...sentKeys(device.remindersSent), ...due].join(",");
        const delivered = await deliverAndRecordReminder(
          () => sendDeviceReminder(device, owner.email, settings),
          () => db.update(devices).set({ remindersSent: merged }).where(eq(devices.id, device.id)),
        );
        if (!delivered) {
          failed = true;
        }
      }

      if (failed) throw new Error("One or more reminder deliveries failed");

      console.info(`[scheduler] checked ${activeDevices.length} active devices for reminders`);
      return;
    } catch (err) {
      const isLast = attempt === maxAttempts - 1;
      if (isLast) {
        if (err instanceof DatabaseUnavailableError) {
          console.info("[scheduler] PostgreSQL is still waking; reminder check deferred");
          throw err;
        }
        console.error("[scheduler] failed to check expiring devices:", err);
        throw err;
      }
      const delay = 1000 * 2 ** attempt;
      console.warn(
        `[scheduler] transient error (attempt ${attempt + 1}/${maxAttempts}), retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

let started = false;

/** Start the in-process reminder scheduler. Safe to call multiple times. */
export function startScheduler(): void {
  if (started) return;
  started = true;
  // First run shortly after boot, then on a fixed interval.
  const run = () => void checkExpiringDevices().catch(() => {});
  setTimeout(run, 30_000);
  setInterval(run, CHECK_INTERVAL_MS);
  console.info("[scheduler] reminder scheduler started (every 15 min)");
}
