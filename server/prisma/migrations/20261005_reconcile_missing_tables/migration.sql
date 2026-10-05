-- Reconcile the production database with schema.prisma.
--
-- ─── WHY THIS EXISTS ──────────────────────────────────────────────────────────
--
-- Merge 1295e16d5 ("merge: Contact OS / CRM branch") resolved several schema
-- blocks to main's copy rather than the CRM branch's. Two things were lost:
--
--   1. Nine `@@map(...)` directives. The tables were renamed to snake_case by
--      20260930_unified_business_os, that migration DID run, and then the schema
--      stopped describing the result. Prisma emitted `FROM "CrmClient"` against
--      a table that has never existed under that name.
--
--   2. Eight models whose tables were never created by any migration at all,
--      so `prisma migrate status` reported every migration as applied while the
--      database was missing them.
--
-- The result was that `prisma migrate status` was clean and the application was
-- broken. Verified against production before writing this:
--
--   crmClient, crmJob, crmEmployee, crmPayroll, crmExpense
--       The table `public.CrmClient` does not exist in the current database.
--   treasuryBucket, tokenAllocation, merchantSubscription, businessSmsProvider
--       The table `public.TreasuryBucket` does not exist in the current database.
--   crm.service.ts (5 call sites), subscription.service.ts, sms-provider.service.ts,
--   pab-supply.ts — all returning 500 in production.
--
-- `CrmClient` was fixed in schema.prisma by restoring its `@@map`, not here —
-- that one needed no DDL, because the table was already present and correct.
--
-- ─── WHY THIS MIGRATION IS SCOPED SO NARROWLY ─────────────────────────────────
--
-- `prisma migrate diff` between production and schema.prisma also proposes
-- dropping foreign keys, dropping indexes, and altering nullability on
-- Appointment, Invoice, FeeAssessment, CrmActivity, CrmDeal and CrmFile. None of
-- that is broken; it is ordinary accumulated drift. Applying it here would be a
-- large, unreviewed change to live tables bundled into a fix for tables that do
-- not exist. That drift is real and deserves its own reviewed migration.
--
-- ─── ADDITIVE BY CONSTRUCTION ─────────────────────────────────────────────────
--
-- Every statement below is a CREATE TABLE or an ADD COLUMN. Nothing is dropped,
-- renamed, or tightened. All eight target tables were confirmed to hold zero
-- rows, so there is no data to reshape and no backfill to get wrong.
--
-- The ADD COLUMNs are not cosmetic: `crmScope()` in crm.service.ts builds
-- `{ businessId }` predicates dynamically, so every CRM read and write through
-- the tenant path needs that column to exist on the table it filters.
--
-- ─── NOT INCLUDED ─────────────────────────────────────────────────────────────
--
-- `CrmBusiness` is deliberately NOT created. It is a duplicate of
-- `CrmServiceBusiness` — the same concept, two tables, one shared by an email
-- join that its own comment calls "a weak join". Creating it would make the
-- endpoints work again while leaving two sources of truth for "the CRM business",
-- which is the same defect class as the 750-versus-100 scale problem fixed in
-- 71ee3064b. It is resolved by consolidating the three call sites onto
-- CrmServiceBusiness, which is a code change rather than a DDL one.

-- ─── Missing tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BusinessSmsProvider" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessSmsProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MerchantSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "whopMembershipId" TEXT,
    "whopPlanId" TEXT,
    "whopCompanyId" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "lastWebhookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TokenAllocation" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "bps" INTEGER NOT NULL,
    "vestingStart" TIMESTAMP(3),
    "vestingEnd" TIMESTAMP(3),
    "vestingCliff" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "TreasuryBucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocationBps" INTEGER NOT NULL,
    "balancePab" BIGINT NOT NULL DEFAULT 0,
    "balanceUsdCents" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "BuybackRecord" (
    "id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "pabAmount" BIGINT NOT NULL,
    "usdSpentCents" BIGINT NOT NULL,
    "revenueCents" BIGINT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionNote" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "StakingEpoch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revenueCents" BIGINT NOT NULL DEFAULT 0,
    "poolBps" INTEGER NOT NULL DEFAULT 3000,
    "poolCents" BIGINT NOT NULL DEFAULT 0,
    "distributedPab" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "distributedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "TokenBurn" (
    "id" TEXT NOT NULL,
    "pabAmount" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "crm_availability" (
    "id" TEXT NOT NULL,
    "serviceBusinessId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_availability_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_key" ON "BusinessSmsProvider"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_idx" ON "BusinessSmsProvider"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_status_idx" ON "BusinessSmsProvider"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSubscription_businessId_key" ON "MerchantSubscription"("businessId");
CREATE INDEX IF NOT EXISTS "MerchantSubscription_businessId_status_idx" ON "MerchantSubscription"("businessId", "status");
CREATE INDEX IF NOT EXISTS "MerchantSubscription_whopMembershipId_idx" ON "MerchantSubscription"("whopMembershipId");
CREATE INDEX IF NOT EXISTS "MerchantSubscription_status_idx" ON "MerchantSubscription"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "TokenAllocation_category_key" ON "TokenAllocation"("category");
CREATE INDEX IF NOT EXISTS "TokenAllocation_category_idx" ON "TokenAllocation"("category");

CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryBucket_name_key" ON "TreasuryBucket"("name");
CREATE INDEX IF NOT EXISTS "TreasuryBucket_name_idx" ON "TreasuryBucket"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "BuybackRecord_quarter_key" ON "BuybackRecord"("quarter");
CREATE INDEX IF NOT EXISTS "BuybackRecord_status_idx" ON "BuybackRecord"("status");
CREATE INDEX IF NOT EXISTS "BuybackRecord_quarter_idx" ON "BuybackRecord"("quarter");

CREATE UNIQUE INDEX IF NOT EXISTS "StakingEpoch_label_key" ON "StakingEpoch"("label");
CREATE INDEX IF NOT EXISTS "StakingEpoch_status_idx" ON "StakingEpoch"("status");
CREATE INDEX IF NOT EXISTS "StakingEpoch_startsAt_idx" ON "StakingEpoch"("startsAt");

CREATE INDEX IF NOT EXISTS "TokenBurn_createdAt_idx" ON "TokenBurn"("createdAt");
CREATE INDEX IF NOT EXISTS "TokenBurn_reason_idx" ON "TokenBurn"("reason");

CREATE INDEX IF NOT EXISTS "crm_availability_serviceBusinessId_weekday_idx" ON "crm_availability"("serviceBusinessId", "weekday");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_availability_serviceBusinessId_weekday_startTime_key" ON "crm_availability"("serviceBusinessId", "weekday", "startTime");

-- ─── Foreign keys ─────────────────────────────────────────────────────────────
--
-- Added separately from the CREATE TABLE so that re-running this migration
-- against a database where the table already exists cannot fail on a
-- constraint that is already present.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BusinessSmsProvider_businessId_fkey'
    ) THEN
        ALTER TABLE "BusinessSmsProvider"
        ADD CONSTRAINT "BusinessSmsProvider_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MerchantSubscription_businessId_fkey'
    ) THEN
        ALTER TABLE "MerchantSubscription"
        ADD CONSTRAINT "MerchantSubscription_businessId_fkey"
        FOREIGN KEY ("businessId") REFERENCES "Business"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crm_availability_serviceBusinessId_fkey'
    ) THEN
        ALTER TABLE "crm_availability"
        ADD CONSTRAINT "crm_availability_serviceBusinessId_fkey"
        FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ─── Missing columns on the CRM tables restored to their mapped names ──────────
--
-- `@@map` put Prisma back onto tables that already existed, but these models
-- also declare columns the renamed tables do not have.
--
-- `businessId` is the load-bearing one: `crmScope()` builds `{ businessId }`
-- predicates whenever a caller resolves a tenant by platform business id, so
-- without this column every such query fails at the database rather than
-- returning an empty result.

ALTER TABLE "crm_clients"     ADD COLUMN IF NOT EXISTS "businessId"  TEXT;
ALTER TABLE "crm_clients"     ADD COLUMN IF NOT EXISTS "isActive"    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "crm_employees"   ADD COLUMN IF NOT EXISTS "businessId"  TEXT;
ALTER TABLE "crm_jobs"        ADD COLUMN IF NOT EXISTS "businessId"  TEXT;
ALTER TABLE "crm_jobs"        ADD COLUMN IF NOT EXISTS "duration"    INTEGER;
ALTER TABLE "crm_jobs"        ADD COLUMN IF NOT EXISTS "employeeId"  TEXT;
ALTER TABLE "crm_payrolls"    ADD COLUMN IF NOT EXISTS "businessId"  TEXT;
ALTER TABLE "crm_expenses"    ADD COLUMN IF NOT EXISTS "businessId"  TEXT;

-- ─── Indexes for the added columns ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "crm_clients_businessId_idx"   ON "crm_clients"("businessId");
CREATE INDEX IF NOT EXISTS "crm_employees_businessId_idx" ON "crm_employees"("businessId");
CREATE INDEX IF NOT EXISTS "crm_jobs_businessId_idx"      ON "crm_jobs"("businessId");
CREATE INDEX IF NOT EXISTS "crm_jobs_employeeId_idx"     ON "crm_jobs"("employeeId");
CREATE INDEX IF NOT EXISTS "crm_payrolls_businessId_idx"  ON "crm_payrolls"("businessId");
CREATE INDEX IF NOT EXISTS "crm_expenses_businessId_idx"  ON "crm_expenses"("businessId");