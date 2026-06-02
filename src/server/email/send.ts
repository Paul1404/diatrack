import nodemailer from "nodemailer";
import { db } from "~/server/db";
import { type AppSettingsRow, type Device, type EmailStatus, emailLogs } from "~/server/db/schema";
import { BODY_LOCATION_LABELS, DEVICE_TYPE_LABELS } from "~/server/labels";
import { reminderEmailHtml } from "./templates";

async function recordEmailLog(entry: {
  toEmail: string;
  subject: string;
  status: EmailStatus;
  emailType: string;
  errorMessage?: string | null;
  durationMs?: number | null;
  smtpHost?: string | null;
}): Promise<void> {
  try {
    await db.insert(emailLogs).values({
      toEmail: entry.toEmail.slice(0, 320),
      subject: entry.subject.slice(0, 500),
      status: entry.status,
      emailType: entry.emailType,
      errorMessage: entry.errorMessage ? entry.errorMessage.slice(0, 4000) : null,
      durationMs: entry.durationMs ?? null,
      smtpHost: entry.smtpHost ? entry.smtpHost.slice(0, 255) : null,
    });
  } catch (err) {
    // Logging failures must never break the email flow.
    console.warn(`[email] failed to persist email log for ${entry.toEmail}:`, err);
  }
}

/**
 * Send an email via the SMTP settings stored in the database. Every call records
 * an email_logs row (success / failed / skipped) so operators can audit delivery.
 * Returns true only when the message was actually sent.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  settings: AppSettingsRow;
  emailType?: string;
}): Promise<boolean> {
  const { to, subject, html, settings } = opts;
  const emailType = opts.emailType ?? "other";

  if (!settings.smtpHost || !settings.smtpFrom) {
    await recordEmailLog({
      toEmail: to,
      subject,
      status: "skipped",
      emailType,
      errorMessage: "SMTP not configured",
      smtpHost: settings.smtpHost || null,
    });
    return false;
  }

  const start = performance.now();
  try {
    const secure = settings.smtpPort === 465;
    const transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure,
      requireTLS: settings.smtpTls && !secure,
      auth:
        settings.smtpUser && settings.smtpPassword
          ? { user: settings.smtpUser, pass: settings.smtpPassword }
          : undefined,
    });

    await transport.sendMail({ from: settings.smtpFrom, to, subject, html });

    const durationMs = Math.round(performance.now() - start);
    await recordEmailLog({
      toEmail: to,
      subject,
      status: "success",
      emailType,
      durationMs,
      smtpHost: settings.smtpHost,
    });
    console.info(`[email] sent to ${to}: ${subject} (${durationMs}ms)`);
    return true;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    await recordEmailLog({
      toEmail: to,
      subject,
      status: "failed",
      emailType,
      errorMessage: message,
      durationMs,
      smtpHost: settings.smtpHost,
    });
    console.error(`[email] failed to send to ${to}: ${message}`);
    return false;
  }
}

/** Send an expiry reminder for a specific device. */
export async function sendDeviceReminder(
  device: Device,
  userEmail: string,
  settings: AppSettingsRow,
): Promise<void> {
  const endTime = device.startTime.getTime() + device.plannedDurationHours * 3_600_000;
  const hoursRemaining = Math.max(0, (endTime - Date.now()) / 3_600_000);

  const color = hoursRemaining <= 6 ? "#DE350B" : hoursRemaining <= 24 ? "#FF991F" : "#00875A";
  const deviceTypeLabel = DEVICE_TYPE_LABELS[device.deviceType];
  const rounded = Math.round(hoursRemaining);

  const html = reminderEmailHtml({
    deviceTypeLabel,
    bodyLocation: BODY_LOCATION_LABELS[device.bodyLocation],
    hoursRemaining: rounded,
    startTime: device.startTime.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    color,
    appUrl: settings.appUrl,
  });

  await sendEmail({
    to: userEmail,
    subject: `DiaTrack: ${deviceTypeLabel} läuft in ca. ${rounded} Stunden ab`,
    html,
    settings,
    emailType: "device_reminder",
  });
}
