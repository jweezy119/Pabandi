-- Objects added by the 20261122 migrations.
--
-- WHY THIS FILE EXISTS
-- The deploy path does NOT run `prisma migrate deploy`. Render's preDeployCommand
-- runs ensure-agent-tables.cjs, which executes server/sql/*.sql directly, and
-- src/utils/tableBootstrap.ts runs the same statements at boot. A table or column
-- that exists only in prisma/migrations/ does not exist in production.
--
-- That is not theoretical: 20261122_dashboard_theme_json,
-- 20261122_sms_models and 20261122_booking_job_assignment all applied cleanly in
-- CI and in local runs, and none of them reached production. The runtime schema
-- check caught it: dashboardTheme still TEXT, Booking.employeeId missing,
-- SMSLog and ChannelMessage missing.
--
-- BusinessSmsProvider and MerchantSubscription are deliberately NOT here -
-- sms-provider-tables.sql and fee-tables.sql already create them, which is why
-- the check found those two while the others were absent.
--
-- Idempotent: safe on every deploy and every boot. Keep in step with
-- prisma/schema.prisma, and add this filename to SQL_FILES in BOTH
-- scripts/ensure-agent-tables.cjs and src/utils/tableBootstrap.ts.

-- ── 20261122_booking_job_assignment ──────────────────────────────────────────
-- Job assignment and check-in state live on Booking. CRM jobs ARE bookings, so a
-- second assignment table mirroring them would be a dead relation.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);

-- The conflict check scans by employee across a slotStart window, so without
-- these every assignment check reads the business's whole job history.
CREATE INDEX IF NOT EXISTS "Booking_employeeId_idx" ON "Booking"("employeeId");
CREATE INDEX IF NOT EXISTS "Booking_employeeId_slotStart_idx" ON "Booking"("employeeId", "slotStart");

-- ── 20261122_dashboard_theme_json ─────────────────────────────────────────────
-- The column existed as TEXT while ModularDashboard saves a DashboardTheme
-- OBJECT and settings.service reads it back with `?? {}`. A presence-only check
-- passed the whole time and every dashboard save 500'd.
--
-- Guarded on the TYPE, not on existence: re-running this against an already
-- converted column must be a no-op, and the USING clause reads through ::text so
-- it converges rather than double-encoding if it ever does run twice.

-- ── 20261122_sms_models ───────────────────────────────────────────────────────
-- SMSLog and ChannelMessage. (MerchantSubscription and BusinessSmsProvider come
-- from fee-tables.sql and sms-provider-tables.sql.)

CREATE TABLE IF NOT EXISTS "SMSLog" (
  "id"          TEXT        NOT NULL,
  "businessId"  TEXT        NOT NULL,
  "to"          TEXT        NOT NULL,
  "message"     TEXT        NOT NULL,
  "provider"    TEXT        NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'PENDING',
  "externalId"  TEXT,
  "cost"        DOUBLE PRECISION,
  "sentAt"      TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SMSLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChannelMessage" (
  "id"          TEXT        NOT NULL,
  "businessId"  TEXT        NOT NULL,
  "customerId"  TEXT        NOT NULL,
  "channel"     TEXT        NOT NULL,
  "direction"   TEXT        NOT NULL,
  "content"     TEXT        NOT NULL,
  "status"      TEXT        NOT NULL DEFAULT 'PENDING',
  "externalId"  TEXT,
  "sentAt"      TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt"    TIMESTAMP(3),
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SMSLog_businessId_idx" ON "SMSLog"("businessId");
CREATE INDEX IF NOT EXISTS "SMSLog_status_idx" ON "SMSLog"("status");
CREATE INDEX IF NOT EXISTS "SMSLog_provider_idx" ON "SMSLog"("provider");

CREATE INDEX IF NOT EXISTS "ChannelMessage_businessId_idx" ON "ChannelMessage"("businessId");
CREATE INDEX IF NOT EXISTS "ChannelMessage_customerId_idx" ON "ChannelMessage"("customerId");
CREATE INDEX IF NOT EXISTS "ChannelMessage_channel_idx" ON "ChannelMessage"("channel");
CREATE INDEX IF NOT EXISTS "ChannelMessage_status_idx" ON "ChannelMessage"("status");
CREATE INDEX IF NOT EXISTS "ChannelMessage_createdAt_idx" ON "ChannelMessage"("createdAt");

-- FKs added separately and guarded, matching the pattern in sms-provider-tables.sql:
-- re-running an ADD CONSTRAINT that already exists would fail and abort the rest
-- of the file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SMSLog_businessId_fkey') THEN
    ALTER TABLE "SMSLog" ADD CONSTRAINT "SMSLog_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelMessage_businessId_fkey') THEN
    ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'BusinessSettings'
      AND column_name = 'dashboardTheme'
      AND data_type <> 'jsonb'
  ) THEN
    -- The old column carried a TEXT default ('light'). PostgreSQL refuses to
    -- change the type while a default of the old type is attached —
    -- "default for column cannot be cast automatically to type jsonb" — so it has
    -- to go first. The USING clause below is what actually converts the values.
    ALTER TABLE "BusinessSettings" ALTER COLUMN "dashboardTheme" DROP DEFAULT;
    ALTER TABLE "BusinessSettings"
      ALTER COLUMN "dashboardTheme" TYPE JSONB
      USING CASE
        WHEN "dashboardTheme" IS NULL THEN NULL::jsonb
        WHEN btrim("dashboardTheme"::text) IN ('', 'null', '"null"') THEN NULL::jsonb
        WHEN btrim("dashboardTheme"::text) ~ '^[[:space:]]*[{\[]' THEN btrim("dashboardTheme"::text)::jsonb
        ELSE to_jsonb(btrim(btrim("dashboardTheme"::text), '"'))
      END;
  END IF;
END
$$;
