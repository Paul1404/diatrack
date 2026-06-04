import { describe, expect, it } from "vitest";
import type { Device } from "~/server/db/schema";
import { dueReminderKeys } from "~/server/reminders";

type ReminderDevice = Pick<Device, "startTime" | "plannedDurationHours" | "remindersSent">;

const HOUR = 3_600_000;

function makeDevice(overrides: Partial<ReminderDevice> = {}): ReminderDevice {
  return {
    startTime: new Date(),
    plannedDurationHours: 240,
    remindersSent: "",
    ...overrides,
  };
}

describe("dueReminderKeys", () => {
  const now = Date.now();

  it("returns nothing while remaining time is above every interval", () => {
    // 240h device, 1h in -> 239h remaining, neither 24h nor 6h reached yet.
    const device = makeDevice({ startTime: new Date(now - 1 * HOUR) });
    expect(dueReminderKeys(device, [24, 6], now)).toEqual([]);
  });

  it("fires the 24h reminder once remaining drops below 24h", () => {
    const device = makeDevice({ startTime: new Date(now - 217 * HOUR) }); // 23h left
    expect(dueReminderKeys(device, [24, 6], now)).toEqual(["24h"]);
  });

  it("does not refire a reminder already recorded", () => {
    const device = makeDevice({
      startTime: new Date(now - 217 * HOUR),
      remindersSent: "24h",
    });
    expect(dueReminderKeys(device, [24, 6], now)).toEqual([]);
  });

  it("catches up missed reminders instead of skipping them", () => {
    // Only 5h left: both the 24h and 6h reminders are overdue and should fire.
    const device = makeDevice({ startTime: new Date(now - 235 * HOUR) });
    expect(dueReminderKeys(device, [24, 6], now)).toEqual(["24h", "6h"]);
  });

  it("returns nothing for an already expired device", () => {
    const device = makeDevice({ startTime: new Date(now - 300 * HOUR) });
    expect(dueReminderKeys(device, [24, 6], now)).toEqual([]);
  });

  it("skips intervals not shorter than the device's planned lifetime", () => {
    // A 6h catheter must never trigger a 24h-lead reminder.
    const device = makeDevice({
      plannedDurationHours: 6,
      startTime: new Date(now - 1 * HOUR), // 5h left
    });
    expect(dueReminderKeys(device, [24, 6], now)).toEqual([]);
  });

  it("matches keys exactly so a sent 16h does not suppress a pending 6h", () => {
    const device = makeDevice({
      startTime: new Date(now - 235 * HOUR), // 5h left, both 16h and 6h crossed
      remindersSent: "16h",
    });
    expect(dueReminderKeys(device, [16, 6], now)).toEqual(["6h"]);
  });
});
