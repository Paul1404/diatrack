import { eq } from "drizzle-orm";
import { getAppSettings } from "~/server/app-settings";
import { db } from "~/server/db";
import { DEFAULT_USER_SETTINGS, devices, user } from "~/server/db/schema";
import { sendDeviceReminder } from "~/server/email/send";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const WINDOW_HOURS = 0.25; // +/- 15 min tolerance around each reminder interval

/**
 * Check active devices and send expiry reminders. For each active device, for
 * each of the user's reminder intervals, send once when the remaining time is
 * within the interval window and the reminder has not already been sent. Sent
 * reminders are tracked in devices.remindersSent (comma-separated "{n}h" keys).
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
        const endTime = device.startTime.getTime() + device.plannedDurationHours * 3_600_000;
        const hoursRemaining = (endTime - now) / 3_600_000;

        let remindersSent = device.remindersSent;
        for (const interval of intervals) {
          const key = `${interval}h`;
          if (remindersSent.includes(key)) continue;

          if (
            interval - WINDOW_HOURS <= hoursRemaining &&
            hoursRemaining <= interval + WINDOW_HOURS
          ) {
            await sendDeviceReminder(device, owner.email, settings);
            remindersSent = remindersSent ? `${remindersSent},${key}` : key;
            await db.update(devices).set({ remindersSent }).where(eq(devices.id, device.id));
          }
        }
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
