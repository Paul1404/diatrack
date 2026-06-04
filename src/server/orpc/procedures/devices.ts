import { ORPCError } from "@orpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import * as v from "valibot";
import { db } from "~/server/db";
import { DEFAULT_USER_SETTINGS, devices, failureLogs, user } from "~/server/db/schema";
import { type DeviceResponse, deviceToResponse } from "~/server/devices";
import { authed } from "~/server/orpc/context";

const deviceTypeSchema = v.picklist(["sensor", "catheter"]);
const bodyLocationSchema = v.picklist([
  "abdomen_left",
  "abdomen_right",
  "thigh_left",
  "thigh_right",
  "upper_arm_left",
  "upper_arm_right",
  "buttock_left",
  "buttock_right",
  "lower_back_left",
  "lower_back_right",
]);
const failureReasonSchema = v.picklist([
  "clogged",
  "fell_off",
  "sensor_error",
  "skin_reaction",
  "other",
]);

const SENSOR_FALLBACK_HOURS = 240;
const CATHETER_FALLBACK_HOURS = 72;

async function ownedDevice(deviceId: number, userId: string) {
  const [row] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Gerät nicht gefunden" });
  }
  return row;
}

export const list = authed
  .input(
    v.object({
      activeOnly: v.optional(v.boolean(), false),
      deviceType: v.optional(deviceTypeSchema),
    }),
  )
  .handler(async ({ input, context }): Promise<DeviceResponse[]> => {
    const conditions = [eq(devices.userId, context.user.id)];
    if (input.activeOnly) conditions.push(eq(devices.status, "active"));
    if (input.deviceType) conditions.push(eq(devices.deviceType, input.deviceType));

    const rows = await db
      .select()
      .from(devices)
      .leftJoin(failureLogs, eq(failureLogs.deviceId, devices.id))
      .where(and(...conditions))
      .orderBy(desc(devices.startTime));

    return rows.map((r) => deviceToResponse(r.devices, r.failure_logs));
  });

export const get = authed
  .input(v.object({ id: v.number() }))
  .handler(async ({ input, context }): Promise<DeviceResponse> => {
    const device = await ownedDevice(input.id, context.user.id);
    const [failure] = await db
      .select()
      .from(failureLogs)
      .where(eq(failureLogs.deviceId, device.id))
      .limit(1);
    return deviceToResponse(device, failure ?? null);
  });

export const create = authed
  .input(
    v.object({
      deviceType: deviceTypeSchema,
      bodyLocation: bodyLocationSchema,
      startTime: v.optional(v.date()),
      plannedDurationHours: v.optional(v.pipe(v.number(), v.minValue(0))),
    }),
  )
  .handler(async ({ input, context }): Promise<DeviceResponse> => {
    let planned = input.plannedDurationHours;
    if (planned == null) {
      const [row] = await db
        .select({ settings: user.settings })
        .from(user)
        .where(eq(user.id, context.user.id))
        .limit(1);
      const settings = row?.settings ?? DEFAULT_USER_SETTINGS;
      planned =
        input.deviceType === "sensor" ? settings.sensorDefaultHours : settings.catheterDefaultHours;
    }
    // Safety net against legacy/zero settings.
    if (!planned || planned <= 0) {
      planned = input.deviceType === "sensor" ? SENSOR_FALLBACK_HOURS : CATHETER_FALLBACK_HOURS;
    }

    const [created] = await db
      .insert(devices)
      .values({
        userId: context.user.id,
        deviceType: input.deviceType,
        bodyLocation: input.bodyLocation,
        startTime: input.startTime ?? new Date(),
        plannedDurationHours: planned,
        status: "active",
        remindersSent: "",
      })
      .returning();

    return deviceToResponse(created, null);
  });

export const update = authed
  .input(v.object({ id: v.number(), startTime: v.date() }))
  .handler(async ({ input, context }): Promise<DeviceResponse> => {
    const device = await ownedDevice(input.id, context.user.id);
    // Reset sent reminders: the schedule changed, so reminders must be
    // recomputed against the new start time instead of staying suppressed.
    const [updated] = await db
      .update(devices)
      .set({ startTime: input.startTime, remindersSent: "" })
      .where(eq(devices.id, device.id))
      .returning();
    const [failure] = await db
      .select()
      .from(failureLogs)
      .where(eq(failureLogs.deviceId, device.id))
      .limit(1);
    return deviceToResponse(updated, failure ?? null);
  });

export const end = authed
  .input(v.object({ id: v.number() }))
  .handler(async ({ input, context }): Promise<DeviceResponse> => {
    const device = await ownedDevice(input.id, context.user.id);
    if (device.status !== "active") {
      throw new ORPCError("VALIDATION_FAILED", { message: "Gerät ist nicht aktiv" });
    }
    const [updated] = await db
      .update(devices)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(devices.id, device.id))
      .returning();
    return deviceToResponse(updated, null);
  });

export const reportFailure = authed
  .input(
    v.object({
      id: v.number(),
      reason: failureReasonSchema,
      notes: v.optional(v.string()),
      failedAt: v.optional(v.date()),
    }),
  )
  .handler(async ({ input, context }): Promise<DeviceResponse> => {
    const device = await ownedDevice(input.id, context.user.id);
    if (device.status !== "active") {
      throw new ORPCError("VALIDATION_FAILED", { message: "Gerät ist nicht aktiv" });
    }

    const [updated] = await db
      .update(devices)
      .set({ status: "failed", endedAt: input.failedAt ?? new Date() })
      .where(eq(devices.id, device.id))
      .returning();

    const [failure] = await db
      .insert(failureLogs)
      .values({ deviceId: device.id, reason: input.reason, notes: input.notes ?? null })
      .returning();

    return deviceToResponse(updated, failure);
  });

export const remove = authed
  .input(v.object({ id: v.number() }))
  .handler(async ({ input, context }): Promise<{ success: true }> => {
    const device = await ownedDevice(input.id, context.user.id);
    await db.delete(devices).where(eq(devices.id, device.id));
    return { success: true };
  });

export const clearHistory = authed.handler(async ({ context }): Promise<{ deleted: number }> => {
  // Failure logs cascade on device delete, so deleting the devices is enough.
  const deleted = await db
    .delete(devices)
    .where(and(eq(devices.userId, context.user.id), ne(devices.status, "active")))
    .returning({ id: devices.id });
  return { deleted: deleted.length };
});
