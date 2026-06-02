import { ORPCError } from "@orpc/server";
import { desc, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { getAppSettings } from "~/server/app-settings";
import { db } from "~/server/db";
import { appSettings, type EmailStatus, emailLogs } from "~/server/db/schema";
import { sendEmail } from "~/server/email/send";
import { smtpTestHtml } from "~/server/email/templates";
import { EMAIL_STATUS_LABELS } from "~/server/labels";
import { admin } from "~/server/orpc/context";

export interface AppSettingsResponse {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
  smtpTls: boolean;
  appUrl: string;
}

// Note: smtpPassword is never returned to the client.
export const getSettings = admin.handler(async (): Promise<AppSettingsResponse> => {
  const s = await getAppSettings();
  return {
    smtpHost: s.smtpHost,
    smtpPort: s.smtpPort,
    smtpUser: s.smtpUser,
    smtpFrom: s.smtpFrom,
    smtpTls: s.smtpTls,
    appUrl: s.appUrl,
  };
});

export const updateSettings = admin
  .input(
    v.object({
      smtpHost: v.optional(v.string()),
      smtpPort: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(65535))),
      smtpUser: v.optional(v.string()),
      smtpPassword: v.optional(v.string()),
      smtpFrom: v.optional(v.string()),
      smtpTls: v.optional(v.boolean()),
      appUrl: v.optional(v.string()),
    }),
  )
  .handler(async ({ input }): Promise<AppSettingsResponse> => {
    await getAppSettings(); // ensure the row exists
    const patch: Record<string, unknown> = {};
    for (const key of [
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPassword",
      "smtpFrom",
      "smtpTls",
      "appUrl",
    ] as const) {
      if (input[key] !== undefined) patch[key] = input[key];
    }
    if (Object.keys(patch).length > 0) {
      await db.update(appSettings).set(patch).where(eq(appSettings.id, 1));
    }
    const s = await getAppSettings();
    return {
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpUser: s.smtpUser,
      smtpFrom: s.smtpFrom,
      smtpTls: s.smtpTls,
      appUrl: s.appUrl,
    };
  });

export const testSmtp = admin
  .input(v.object({ email: v.pipe(v.string(), v.email("Ungültige E-Mail-Adresse")) }))
  .handler(async ({ input }): Promise<{ message: string }> => {
    const s = await getAppSettings();
    if (!s.smtpHost || !s.smtpFrom) {
      throw new ORPCError("VALIDATION_FAILED", {
        message: "SMTP-Einstellungen nicht konfiguriert",
      });
    }
    const ok = await sendEmail({
      to: input.email,
      subject: "DiaTrack: SMTP Test",
      html: smtpTestHtml(),
      settings: s,
      emailType: "smtp_test",
    });
    if (!ok) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Test-E-Mail konnte nicht gesendet werden",
      });
    }
    return { message: "Test-E-Mail erfolgreich gesendet" };
  });

export interface EmailLogEntry {
  id: number;
  toEmail: string;
  subject: string;
  status: EmailStatus;
  statusLabel: string;
  emailType: string;
  errorMessage: string | null;
  durationMs: number | null;
  smtpHost: string | null;
  createdAt: Date;
}

export const listEmailLogs = admin
  .input(
    v.object({
      limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)), 100),
      offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), 0),
      status: v.optional(v.picklist(["success", "failed", "skipped"])),
    }),
  )
  .handler(async ({ input }): Promise<{ total: number; entries: EmailLogEntry[] }> => {
    const where = input.status ? eq(emailLogs.status, input.status) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emailLogs)
      .where(where);

    const rows = await db
      .select()
      .from(emailLogs)
      .where(where)
      .orderBy(desc(emailLogs.createdAt), desc(emailLogs.id))
      .limit(input.limit)
      .offset(input.offset);

    return {
      total: Number(count),
      entries: rows.map((r) => ({
        id: r.id,
        toEmail: r.toEmail,
        subject: r.subject,
        status: r.status,
        statusLabel: EMAIL_STATUS_LABELS[r.status],
        emailType: r.emailType,
        errorMessage: r.errorMessage,
        durationMs: r.durationMs,
        smtpHost: r.smtpHost,
        createdAt: r.createdAt,
      })),
    };
  });

export const clearEmailLogs = admin.handler(async (): Promise<{ success: true }> => {
  await db.delete(emailLogs);
  return { success: true };
});
