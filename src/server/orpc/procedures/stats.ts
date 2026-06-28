import { and, desc, eq, gte, sql } from "drizzle-orm";
import * as v from "valibot";
import { db } from "~/server/db";
import type { BodyLocation, DeviceType, FailureReason } from "~/server/db/schema";
import { devices, failureLogs } from "~/server/db/schema";
import { BODY_LOCATION_LABELS, FAILURE_REASON_LABELS } from "~/server/labels";
import { authed } from "~/server/orpc/context";

// Postgres duration-in-hours expression for a finished device.
const durationHours = sql<number>`(extract(epoch from ${devices.endedAt}) - extract(epoch from ${devices.startTime})) / 3600.0`;

const num = (val: unknown): number => (val == null ? 0 : Number(val));
const numOrNull = (val: unknown): number | null => (val == null ? null : Number(val));
const round1 = (val: number): number => Math.round(val * 10) / 10;

export interface OverviewStats {
  totalDevices: number;
  activeDevices: number;
  completedDevices: number;
  failedDevices: number;
  sensorFailureRate: number;
  catheterFailureRate: number;
  avgSensorDurationHours: number | null;
  avgCatheterDurationHours: number | null;
}

export const overview = authed.handler(async ({ context }): Promise<OverviewStats> => {
  const [row] = await db
    .select({
      total: sql`count(*)`,
      active: sql`sum(case when ${devices.status} = 'active' then 1 else 0 end)`,
      completed: sql`sum(case when ${devices.status} = 'completed' then 1 else 0 end)`,
      failed: sql`sum(case when ${devices.status} = 'failed' then 1 else 0 end)`,
      sensorTotal: sql`sum(case when ${devices.deviceType} = 'sensor' and ${devices.status} != 'active' then 1 else 0 end)`,
      sensorFailed: sql`sum(case when ${devices.deviceType} = 'sensor' and ${devices.status} = 'failed' then 1 else 0 end)`,
      catheterTotal: sql`sum(case when ${devices.deviceType} = 'catheter' and ${devices.status} != 'active' then 1 else 0 end)`,
      catheterFailed: sql`sum(case when ${devices.deviceType} = 'catheter' and ${devices.status} = 'failed' then 1 else 0 end)`,
      avgSensorHours: sql`avg(case when ${devices.deviceType} = 'sensor' and ${devices.status} != 'active' and ${devices.endedAt} is not null then ${durationHours} else null end)`,
      avgCatheterHours: sql`avg(case when ${devices.deviceType} = 'catheter' and ${devices.status} != 'active' and ${devices.endedAt} is not null then ${durationHours} else null end)`,
    })
    .from(devices)
    .where(eq(devices.userId, context.user.id));

  const sensorTotal = num(row?.sensorTotal);
  const sensorFailed = num(row?.sensorFailed);
  const catheterTotal = num(row?.catheterTotal);
  const catheterFailed = num(row?.catheterFailed);

  return {
    totalDevices: num(row?.total),
    activeDevices: num(row?.active),
    completedDevices: num(row?.completed),
    failedDevices: num(row?.failed),
    sensorFailureRate: sensorTotal > 0 ? round1((sensorFailed / sensorTotal) * 100) : 0,
    catheterFailureRate: catheterTotal > 0 ? round1((catheterFailed / catheterTotal) * 100) : 0,
    avgSensorDurationHours: numOrNull(row?.avgSensorHours),
    avgCatheterDurationHours: numOrNull(row?.avgCatheterHours),
  };
});

export interface FailureByReason {
  reason: FailureReason;
  reasonLabel: string;
  count: number;
  percentage: number;
}
export interface FailureByLocation {
  bodyLocation: BodyLocation;
  bodyLocationLabel: string;
  totalDevices: number;
  failedDevices: number;
  failureRate: number;
}
export interface MTBFStats {
  deviceType: DeviceType;
  mtbfHours: number | null;
  totalFailures: number;
  totalCompleted: number;
}
export interface FailureStats {
  byReason: FailureByReason[];
  byLocation: FailureByLocation[];
  byDeviceType: MTBFStats[];
}

export const failures = authed.handler(async ({ context }): Promise<FailureStats> => {
  // By reason
  const reasonRows = await db
    .select({ reason: failureLogs.reason, count: sql`count(${failureLogs.id})` })
    .from(failureLogs)
    .innerJoin(devices, eq(failureLogs.deviceId, devices.id))
    .where(eq(devices.userId, context.user.id))
    .groupBy(failureLogs.reason);

  const totalFailures = reasonRows.reduce((acc, r) => acc + num(r.count), 0);
  const byReason: FailureByReason[] = reasonRows.map((r) => ({
    reason: r.reason,
    reasonLabel: FAILURE_REASON_LABELS[r.reason],
    count: num(r.count),
    percentage: totalFailures > 0 ? round1((num(r.count) / totalFailures) * 100) : 0,
  }));

  // By body location (finished devices only)
  const locationRows = await db
    .select({
      bodyLocation: devices.bodyLocation,
      total: sql`count(${devices.id})`,
      failed: sql`sum(case when ${devices.status} = 'failed' then 1 else 0 end)`,
    })
    .from(devices)
    .where(and(eq(devices.userId, context.user.id), sql`${devices.status} != 'active'`))
    .groupBy(devices.bodyLocation);

  const byLocation: FailureByLocation[] = locationRows.map((r) => {
    const total = num(r.total);
    const failed = num(r.failed);
    return {
      bodyLocation: r.bodyLocation,
      bodyLocationLabel: BODY_LOCATION_LABELS[r.bodyLocation],
      totalDevices: total,
      failedDevices: failed,
      failureRate: total > 0 ? round1((failed / total) * 100) : 0,
    };
  });

  // MTBF per device type
  const byDeviceType: MTBFStats[] = [];
  for (const deviceType of ["sensor", "catheter"] as const) {
    const [row] = await db
      .select({
        totalCompleted: sql`sum(case when ${devices.status} = 'completed' then 1 else 0 end)`,
        totalFailed: sql`sum(case when ${devices.status} = 'failed' then 1 else 0 end)`,
        avgCompletedHours: sql`avg(case when ${devices.status} = 'completed' then ${durationHours} else null end)`,
      })
      .from(devices)
      .where(
        and(
          eq(devices.userId, context.user.id),
          eq(devices.deviceType, deviceType),
          sql`${devices.status} != 'active'`,
          sql`${devices.endedAt} is not null`,
        ),
      );

    const mtbf = numOrNull(row?.avgCompletedHours);
    byDeviceType.push({
      deviceType,
      mtbfHours: mtbf == null ? null : round1(mtbf),
      totalFailures: num(row?.totalFailed),
      totalCompleted: num(row?.totalCompleted),
    });
  }

  return { byReason, byLocation, byDeviceType };
});

export interface HistoryEntry {
  id: number;
  deviceType: DeviceType;
  bodyLocation: BodyLocation;
  bodyLocationLabel: string;
  lotNumber: string | null;
  startTime: Date;
  plannedEndTime: Date;
  endedAt: Date | null;
  plannedDurationHours: number;
  actualDurationHours: number | null;
  status: string;
  failureReason: FailureReason | null;
}

export const history = authed
  .input(
    v.object({
      deviceType: v.optional(v.picklist(["sensor", "catheter"])),
      days: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(365)), 90),
    }),
  )
  .handler(async ({ input, context }): Promise<HistoryEntry[]> => {
    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const conditions = [eq(devices.userId, context.user.id), gte(devices.startTime, since)];
    if (input.deviceType) conditions.push(eq(devices.deviceType, input.deviceType));

    const rows = await db
      .select()
      .from(devices)
      .leftJoin(failureLogs, eq(failureLogs.deviceId, devices.id))
      .where(and(...conditions))
      .orderBy(desc(devices.startTime));

    return rows.map((r) => {
      const d = r.devices;
      const actual =
        d.endedAt != null
          ? round1((d.endedAt.getTime() - d.startTime.getTime()) / 3_600_000)
          : null;
      return {
        id: d.id,
        deviceType: d.deviceType,
        bodyLocation: d.bodyLocation,
        bodyLocationLabel: BODY_LOCATION_LABELS[d.bodyLocation],
        lotNumber: d.lotNumber,
        startTime: d.startTime,
        plannedEndTime: new Date(d.startTime.getTime() + d.plannedDurationHours * 3_600_000),
        endedAt: d.endedAt,
        plannedDurationHours: d.plannedDurationHours,
        actualDurationHours: actual,
        status: d.status,
        failureReason: r.failure_logs?.reason ?? null,
      };
    });
  });
