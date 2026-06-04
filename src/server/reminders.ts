import type { Device } from "~/server/db/schema";

/** Parse the comma-separated remindersSent string into a set of exact keys. */
export function sentKeys(remindersSent: string): Set<string> {
  return new Set(remindersSent.split(",").filter(Boolean));
}

/**
 * Given a device and the user's reminder intervals, return the reminder keys
 * ("{n}h") that are now due and have not yet been sent.
 *
 * A reminder with lead time `interval` is due once the device has `interval` or
 * fewer planned hours left, but only while it has not yet expired. Intervals
 * that are not shorter than the device's planned lifetime never apply (their
 * lead point would fall on or before the start). This is catch-up safe: a
 * missed scheduler tick still fires the reminder on the next run instead of
 * losing it because a narrow time window was skipped. Keys are compared exactly
 * (split on comma) so e.g. a sent "16h" never suppresses a pending "6h".
 */
export function dueReminderKeys(
  device: Pick<Device, "startTime" | "plannedDurationHours" | "remindersSent">,
  intervals: number[],
  now: number,
): string[] {
  const endTime = device.startTime.getTime() + device.plannedDurationHours * 3_600_000;
  const hoursRemaining = (endTime - now) / 3_600_000;
  if (hoursRemaining <= 0) return []; // already expired, nothing to remind about

  const sent = sentKeys(device.remindersSent);
  const due: string[] = [];
  for (const interval of intervals) {
    const key = `${interval}h`;
    if (sent.has(key)) continue;
    if (interval >= device.plannedDurationHours) continue; // lead point before start
    if (hoursRemaining <= interval) due.push(key);
  }
  return due;
}
