import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const deviceTypeEnum = pgEnum("device_type", ["sensor", "catheter"]);
export const deviceStatusEnum = pgEnum("device_status", ["active", "completed", "failed"]);
export const bodyLocationEnum = pgEnum("body_location", [
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
export const failureReasonEnum = pgEnum("failure_reason", [
  "clogged",
  "fell_off",
  "sensor_error",
  "skin_reaction",
  "other",
]);
export const emailStatusEnum = pgEnum("email_status", ["success", "failed", "skipped"]);

export type DeviceType = (typeof deviceTypeEnum.enumValues)[number];
export type DeviceStatus = (typeof deviceStatusEnum.enumValues)[number];
export type BodyLocation = (typeof bodyLocationEnum.enumValues)[number];
export type FailureReason = (typeof failureReasonEnum.enumValues)[number];
export type EmailStatus = (typeof emailStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Per-user settings shape (stored on user.settings JSONB)
// ---------------------------------------------------------------------------

export interface UserSettings {
  sensorDefaultHours: number;
  catheterDefaultHours: number;
  reminderIntervalsHours: number[];
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  sensorDefaultHours: 240, // 10 days
  catheterDefaultHours: 72, // 3 days
  reminderIntervalsHours: [24, 6],
};

// ---------------------------------------------------------------------------
// better-auth core tables (singular names match better-auth's model names)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  // App-specific additional fields
  isAdmin: boolean("is_admin").default(false).notNull(),
  settings: jsonb("settings").$type<UserSettings>().default(DEFAULT_USER_SETTINGS).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Domain tables
// ---------------------------------------------------------------------------

export const devices = pgTable(
  "devices",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deviceType: deviceTypeEnum("device_type").notNull(),
    bodyLocation: bodyLocationEnum("body_location").notNull(),
    lotNumber: text("lot_number"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    plannedDurationHours: real("planned_duration_hours").notNull(),
    status: deviceStatusEnum("status").default("active").notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    remindersSent: text("reminders_sent").default("").notNull(),
  },
  (t) => [
    index("ix_devices_user_status").on(t.userId, t.status),
    index("ix_devices_user_start").on(t.userId, t.startTime),
  ],
);

export const failureLogs = pgTable("failure_logs", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id")
    .notNull()
    .unique()
    .references(() => devices.id, { onDelete: "cascade" }),
  reason: failureReasonEnum("reason").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emailLogs = pgTable(
  "email_logs",
  {
    id: serial("id").primaryKey(),
    toEmail: varchar("to_email", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: emailStatusEnum("status").notNull(),
    emailType: varchar("email_type", { length: 64 }).default("other").notNull(),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    smtpHost: varchar("smtp_host", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ix_email_logs_created_status").on(t.createdAt, t.status)],
);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  smtpHost: text("smtp_host").default("").notNull(),
  smtpPort: integer("smtp_port").default(587).notNull(),
  smtpUser: text("smtp_user").default("").notNull(),
  smtpPassword: text("smtp_password").default("").notNull(),
  smtpFrom: text("smtp_from").default("").notNull(),
  smtpTls: boolean("smtp_tls").default(true).notNull(),
  appUrl: text("app_url").default("https://diatrack.pdcd.net").notNull(),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type FailureLog = typeof failureLogs.$inferSelect;
export type EmailLogRow = typeof emailLogs.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
