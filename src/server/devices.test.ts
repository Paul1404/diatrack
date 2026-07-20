import { describe, expect, it } from "vitest";
import type { Device } from "~/server/db/schema";
import { calculateDeviceProgress, deviceToResponse } from "~/server/devices";

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    userId: "u1",
    deviceType: "sensor",
    bodyLocation: "abdomen_left",
    lotNumber: null,
    startTime: new Date(),
    plannedDurationHours: 240,
    status: "active",
    endedAt: null,
    createdAt: new Date(),
    remindersSent: "",
    ...overrides,
  };
}

describe("calculateDeviceProgress", () => {
  it("returns nulls for non-active devices", () => {
    const result = calculateDeviceProgress(makeDevice({ status: "completed" }));
    expect(result).toEqual({ remainingHours: null, progressPercent: null });
  });

  it("treats non-positive duration as expired", () => {
    const result = calculateDeviceProgress(makeDevice({ plannedDurationHours: 0 }));
    expect(result).toEqual({ remainingHours: 0, progressPercent: 100 });
  });

  it("computes remaining time near the start", () => {
    const result = calculateDeviceProgress(
      makeDevice({ startTime: new Date(), plannedDurationHours: 100 }),
    );
    expect(result.remainingHours).toBeGreaterThan(99);
    expect(result.remainingHours).toBeLessThanOrEqual(100);
    expect(result.progressPercent).toBeGreaterThanOrEqual(0);
    expect(result.progressPercent).toBeLessThan(1);
  });

  it("clamps an expired active device to 0 remaining / 100%", () => {
    const start = new Date(Date.now() - 300 * 3_600_000); // 300h ago
    const result = calculateDeviceProgress(
      makeDevice({ startTime: start, plannedDurationHours: 240 }),
    );
    expect(result.remainingHours).toBe(0);
    expect(result.progressPercent).toBe(100);
  });
});

describe("deviceToResponse", () => {
  it("adds the German body-location label and failure fields", () => {
    const device = makeDevice({ status: "failed", bodyLocation: "thigh_right" });
    const response = deviceToResponse(device, {
      id: 5,
      deviceId: device.id,
      reason: "clogged",
      notes: "verstopft",
      createdAt: new Date(),
    });
    expect(response.bodyLocationLabel).toBe("Oberschenkel rechts");
    expect(response.failureReason).toBe("clogged");
    expect(response.failureNotes).toBe("verstopft");
    expect(response.remainingHours).toBeNull();
  });
});
