CREATE TYPE "public"."body_location" AS ENUM('abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'upper_arm_left', 'upper_arm_right', 'buttock_left', 'buttock_right', 'lower_back_left', 'lower_back_right');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('sensor', 'catheter');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."failure_reason" AS ENUM('clogged', 'fell_off', 'sensor_error', 'skin_reaction', 'other');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"smtp_host" text DEFAULT '' NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"smtp_user" text DEFAULT '' NOT NULL,
	"smtp_password" text DEFAULT '' NOT NULL,
	"smtp_from" text DEFAULT '' NOT NULL,
	"smtp_tls" boolean DEFAULT true NOT NULL,
	"app_url" text DEFAULT 'https://diatrack.pdcd.net' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_type" "device_type" NOT NULL,
	"body_location" "body_location" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"planned_duration_hours" real NOT NULL,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminders_sent" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_email" varchar(320) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"status" "email_status" NOT NULL,
	"email_type" varchar(64) DEFAULT 'other' NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"smtp_host" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"reason" "failure_reason" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "failure_logs_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{"sensorDefaultHours":240,"catheterDefaultHours":72,"reminderIntervalsHours":[24,6]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_logs" ADD CONSTRAINT "failure_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_devices_user_status" ON "devices" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ix_devices_user_start" ON "devices" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "ix_email_logs_created_status" ON "email_logs" USING btree ("created_at","status");