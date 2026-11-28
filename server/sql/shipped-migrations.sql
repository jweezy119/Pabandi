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

-- ── 20261121_outreach ─────────────────────────────────────────────────────────
-- CrmClient outreach opt-in columns and campaign/recipient tables. Without
-- marketingOptIn on crm_clients, every Prisma read of CrmClient (including
-- GET /api/v1/crm/clients and GET /api/v1/business/stats) fails with 500.

ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
  "id"             TEXT        NOT NULL,
  "businessId"     TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "channel"        TEXT        NOT NULL DEFAULT 'EMAIL',
  "subject"        TEXT,
  "body"           TEXT        NOT NULL,
  "status"         TEXT        NOT NULL DEFAULT 'DRAFT',
  "segment"        TEXT,
  "totalCount"     INTEGER     NOT NULL DEFAULT 0,
  "sentCount"      INTEGER     NOT NULL DEFAULT 0,
  "failedCount"    INTEGER     NOT NULL DEFAULT 0,
  "createdById"    TEXT        NOT NULL,
  "idempotencyKey" TEXT,
  "sentAt"         TIMESTAMPTZ,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "outreach_campaigns_idempotencyKey_key" ON "outreach_campaigns"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "outreach_campaigns_businessId_createdAt_idx" ON "outreach_campaigns"("businessId", "createdAt");

CREATE TABLE IF NOT EXISTS "outreach_recipients" (
  "id"         TEXT        NOT NULL,
  "campaignId" TEXT        NOT NULL,
  "clientId"   TEXT,
  "to"         TEXT        NOT NULL,
  "status"     TEXT        NOT NULL DEFAULT 'PENDING',
  "error"      TEXT,
  "sentAt"     TIMESTAMPTZ,
  CONSTRAINT "outreach_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_recipients_campaignId_idx" ON "outreach_recipients"("campaignId");

-- ── 20261121_booking_work_order ───────────────────────────────────────────────
-- Booking.workOrderId link to coordinator WorkOrder. Without this column,
-- GET /api/v1/business/stats and Booking queries fail with 500.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_workOrderId_key" ON "Booking"("workOrderId");

-- ── 20261121_simulator_tables ─────────────────────────────────────────────────
-- ProjectSimulation & SimulationAgentRun tables for the Project Simulator.

CREATE TABLE IF NOT EXISTS "ProjectSimulation" (
  "id"             TEXT        NOT NULL,
  "userId"         TEXT        NOT NULL,
  "projectType"    TEXT        NOT NULL,
  "initialFactors" JSONB       NOT NULL,
  "status"         TEXT        NOT NULL DEFAULT 'draft',
  "finalEstimate"  JSONB,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProjectSimulation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectSimulation_userId_idx" ON "ProjectSimulation"("userId");
CREATE INDEX IF NOT EXISTS "ProjectSimulation_status_idx" ON "ProjectSimulation"("status");

CREATE TABLE IF NOT EXISTS "SimulationAgentRun" (
  "id"              TEXT        NOT NULL,
  "simulationId"    TEXT        NOT NULL,
  "agentRole"       TEXT        NOT NULL,
  "inputPayload"    JSONB       NOT NULL,
  "outputPayload"   JSONB,
  "status"          TEXT        NOT NULL DEFAULT 'pending',
  "executionTimeMs" INTEGER,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SimulationAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimulationAgentRun_simulationId_idx" ON "SimulationAgentRun"("simulationId");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_agentRole_idx" ON "SimulationAgentRun"("agentRole");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_status_idx" ON "SimulationAgentRun"("status");

-- ── BusinessPaymentMethod ─────────────────────────────────────────────────────
-- Saved payout rails per business (Solana USDC, Square, Bank ACH/Wire, PayPal).

CREATE TABLE IF NOT EXISTS "BusinessPaymentMethod" (
  "id"          TEXT         NOT NULL,
  "businessId"  TEXT         NOT NULL,
  "railId"      TEXT         NOT NULL,
  "displayName" TEXT         NOT NULL,
  "target"      TEXT         NOT NULL,
  "isDefault"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BusinessPaymentMethod_businessId_railId_idx" ON "BusinessPaymentMethod"("businessId", "railId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessPaymentMethod_businessId_fkey') THEN
    ALTER TABLE "BusinessPaymentMethod" ADD CONSTRAINT "BusinessPaymentMethod_businessId_fkey"
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Booking.workOrderId — added by prisma/migrations/20261121_booking_work_order.
--
-- Found by the datamodel-derived drift check on its first production run:
--   Booking.workOrderId — declared in schema.prisma and used by the code, but
--   absent from an existing table
-- The column carries the @unique that makes booking -> work-order creation
-- idempotent (see services/bookingWorkOrder.service.ts): at most one work order
-- per booking, so a retry cannot create a second. The index and the FK are part
-- of the same object, so all three ship together or not at all.
--
-- Nullable, no backfill: existing bookings simply have no work order yet.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_workOrderId_key" ON "Booking"("workOrderId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'WorkOrder'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'Booking_workOrderId_fkey'
    ) THEN
      ALTER TABLE "Booking" DROP CONSTRAINT "Booking_workOrderId_fkey";
    END IF;

    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_workOrderId_fkey"
      FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- 20261127_crm_custom_data — custom-field values stored on CRM records.
-- Idempotent: this file runs on every deploy and every boot.
ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "customData" JSONB;

CREATE TABLE IF NOT EXISTS "CrmSavedView" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "userId" TEXT,
  "objectType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB,
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmSavedView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmSavedView_businessId_objectType_idx" ON "CrmSavedView"("businessId", "objectType");
CREATE INDEX IF NOT EXISTS "CrmSavedView_userId_objectType_idx" ON "CrmSavedView"("userId", "objectType");

-- Companies, notes and record comments (Phase 2 CRM depth).
CREATE TABLE IF NOT EXISTS "CrmCompany" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "industry" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "customData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCompany_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmCompany_serviceBusinessId_idx" ON "CrmCompany"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "CrmCompany_name_idx" ON "CrmCompany"("name");

CREATE TABLE IF NOT EXISTS "CrmNote" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "clientId" TEXT,
  "dealId" TEXT,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmNote_serviceBusinessId_clientId_idx" ON "CrmNote"("serviceBusinessId", "clientId");
CREATE INDEX IF NOT EXISTS "CrmNote_dealId_idx" ON "CrmNote"("dealId");

CREATE TABLE IF NOT EXISTS "CrmComment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmComment_entityType_entityId_idx" ON "CrmComment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "CrmComment_serviceBusinessId_idx" ON "CrmComment"("serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmAutomationRule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "triggerObject" TEXT NOT NULL,
  "triggerEvent" TEXT NOT NULL,
  "conditions" JSONB,
  "actions" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmAutomationRule_serviceBusinessId_triggerObject_idx" ON "CrmAutomationRule"("serviceBusinessId", "triggerObject");

CREATE TABLE IF NOT EXISTS "CrmObjectDefinition" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "pluralName" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'pentagon',
  "color" TEXT NOT NULL DEFAULT '#C97B5A',
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmObjectDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmObjectDefinition_serviceBusinessId_idx" ON "CrmObjectDefinition"("serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmFieldDefinition" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmFieldDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmFieldDefinition_objectId_idx" ON "CrmFieldDefinition"("objectId");

CREATE TABLE IF NOT EXISTS "CrmCustomRecord" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCustomRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmCustomRecord_objectId_serviceBusinessId_idx" ON "CrmCustomRecord"("objectId", "serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmBuilderProgress" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "badges" JSONB,
  "milestones" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmBuilderProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmBuilderProgress_businessId_key" ON "CrmBuilderProgress"("businessId");

CREATE TABLE IF NOT EXISTS "CrmBlueprintTemplate" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT NOT NULL DEFAULT '✨',
  "color" TEXT NOT NULL DEFAULT '#C97B5A',
  "data" JSONB NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmBlueprintTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmBlueprintTemplate_isPublic_idx" ON "CrmBlueprintTemplate"("isPublic");
CREATE INDEX IF NOT EXISTS "CrmBlueprintTemplate_businessId_idx" ON "CrmBlueprintTemplate"("businessId");

CREATE TABLE IF NOT EXISTS "CrmMailAccount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "imapHost" TEXT NOT NULL,
  "imapPort" INTEGER NOT NULL DEFAULT 993,
  "imapSecure" BOOLEAN NOT NULL DEFAULT true,
  "imapUser" TEXT NOT NULL,
  "imapPassword" TEXT NOT NULL,
  "smtpHost" TEXT,
  "smtpPort" INTEGER DEFAULT 587,
  "smtpUser" TEXT,
  "smtpPassword" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmMailAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmMailAccount_businessId_key" ON "CrmMailAccount"("businessId");

CREATE TABLE IF NOT EXISTS "CrmCalendarAccount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Calendar',
  "calendarUrl" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCalendarAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCalendarAccount_businessId_key" ON "CrmCalendarAccount"("businessId");

CREATE TABLE IF NOT EXISTS "CrmAutomationRun" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "businessId" TEXT,
  "event" TEXT NOT NULL,
  "recordId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "actions" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmAutomationRun_ruleId_createdAt_idx" ON "CrmAutomationRun"("ruleId", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmWebhookDelivery" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "businessId" TEXT,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmWebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmWebhookDelivery_endpointId_createdAt_idx" ON "CrmWebhookDelivery"("endpointId", "createdAt");
