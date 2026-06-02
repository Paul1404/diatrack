import type { Device, FailureLog } from "~/server/db/schema";
import { bodyLocationLabel } from "~/server/labels";

export interface DeviceResponse {
  id: number;
  deviceType: Device["deviceType"];
  bodyLocation: Device["bodyLocation"];
  bodyLocationLabel: string;
  startTime: Date;
  plannedDurationHours: number;
  status: Device["status"];
  endedAt: Date | null;
  createdAt: Date;
  remainingHours: number | null;
  progressPercent: number | null;
  failureReason: FailureLog["reason"] | null;
  failureNotes: string | null;
}

/**
 * Remaining hours + progress percent for an active device. Non-active devices
 * return nulls. A non-positive planned duration is treated as already expired
 * rather than dividing by zero (guards against bad/legacy data).
 */
export function calculateDeviceProgress(
  device: Pick<Device, "status" | "startTime" | "plannedDurationHours">,
): {
  remainingHours: number | null;
  progressPercent: number | null;
} {
  if (device.status !== "active") {
    return { remainingHours: null, progressPercent: null };
  }

  const elapsedHours = (Date.now() - device.startTime.getTime()) / 3_600_000;
  const duration = device.plannedDurationHours;
  if (!duration || duration <= 0) {
    return { remainingHours: 0, progressPercent: 100 };
  }

  return {
    remainingHours: Math.max(0, duration - elapsedHours),
    progressPercent: Math.min(100, (elapsedHours / duration) * 100),
  };
}

export function deviceToResponse(device: Device, failure: FailureLog | null): DeviceResponse {
  const { remainingHours, progressPercent } = calculateDeviceProgress(device);
  return {
    id: device.id,
    deviceType: device.deviceType,
    bodyLocation: device.bodyLocation,
    bodyLocationLabel: bodyLocationLabel(device.bodyLocation),
    startTime: device.startTime,
    plannedDurationHours: device.plannedDurationHours,
    status: device.status,
    endedAt: device.endedAt,
    createdAt: device.createdAt,
    remainingHours,
    progressPercent,
    failureReason: failure?.reason ?? null,
    failureNotes: failure?.notes ?? null,
  };
}
