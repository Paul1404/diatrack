-- better-auth 1.7 keys accounts on (issuer, account_id) and requires both.
-- Existing 1.6 rows have no issuer, so add the column as nullable, backfill it,
-- then enforce NOT NULL and the compound unique index (per the better-auth 1.7
-- upgrade guide). Only email/password ("credential") accounts exist here; the
-- OAuth branch keeps the migration correct if any other provider row appears.
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint
UPDATE "account" SET "account_id" = "user_id" WHERE "provider_id" = 'credential' AND "account_id" <> "user_id";--> statement-breakpoint
UPDATE "account" SET "issuer" = CASE WHEN "provider_id" = 'credential' THEN 'local:credential' ELSE 'local:oauth:' || "provider_id" END WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");
