import { eq } from "drizzle-orm";
import { getAppSettings } from "~/server/app-settings";
import { db } from "~/server/db";
import { DEFAULT_USER_SETTINGS, devices, user } from "~/server/db/schema";
import { sendDeviceReminder } from "~/server/email/send";
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
      const settings = await getAppSettings();
      const activeDevices = await db.select().from(devices).where(eq(devices.status, "active"));
      const now = Date.now();

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
        await sendDeviceReminder(device, owner.email, settings);
        const merged = [...sentKeys(device.remindersSent), ...due].join(",");
        await db.update(devices).set({ remindersSent: merged }).where(eq(devices.id, device.id));
      }

      console.info(`[scheduler] checked ${activeDevices.length} active devices for reminders`);
      return;
    } catch (err) {
      const isLast = attempt === maxAttempts - 1;
      if (isLast) {
        console.error("[scheduler] failed to check expiring devices:", err);
        return;
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
  setTimeout(() => void checkExpiringDevices(), 30_000);
  setInterval(() => void checkExpiringDevices(), CHECK_INTERVAL_MS);
  console.info("[scheduler] reminder scheduler started (every 15 min)");
}
