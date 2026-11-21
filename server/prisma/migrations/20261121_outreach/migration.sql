-- Outreach: a business reaching its own customers.
--
-- This migration exists because the schema change that introduced outreach
-- shipped without one. autoDeploy turned that into a live outage: the deploy
-- went out, `prisma migrate deploy` had nothing to apply, and every read of
-- CrmClient selected marketingOptIn from a column that did not exist.
--
-- Every statement is idempotent so a retry is safe.

ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "marketingOptInAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "segment" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "sentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "outreach_campaigns_idempotencyKey_key" ON "outreach_campaigns"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "outreach_campaigns_businessId_createdAt_idx" ON "outreach_campaigns"("businessId", "createdAt");

CREATE TABLE IF NOT EXISTS "outreach_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT,
    "to" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMPTZ,
    CONSTRAINT "outreach_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_recipients_campaignId_idx" ON "outreach_recipients"("campaignId");
