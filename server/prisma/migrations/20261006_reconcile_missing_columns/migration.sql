-- Add the columns schema.prisma declares that the database never received.
--
-- ─── WHY ──────────────────────────────────────────────────────────────────────
--
-- Companion to 20261005_reconcile_missing_tables. That migration created the
-- tables that did not exist; this one adds the columns that are declared on
-- tables that DO exist. Same root cause: schema and database diverged, and
-- `prisma migrate status` reported clean throughout because it only compares
-- migration files against each other — it never compares either against
-- schema.prisma.
--
-- Found by dumping every (table, column) pair from information_schema and
-- diffing it against every model's scalar fields. That check is exhaustive and
-- found 10, which is why this is a migration rather than a series of hotfixes:
-- `crm_service_businesses.slug` was missing, so onboarding wrote a slug into a
-- column that was not there.
--
-- ─── EVERY STATEMENT IS ADDITIVE AND NULLABLE ─────────────────────────────────
--
-- Ten columns, all nullable, none with a NOT NULL constraint and none with a
-- default that would rewrite existing rows. There is no data to backfill and no
-- existing row changes value. If a model has been writing through Prisma while
-- its column was absent, the write was failing; adding the column turns a hard
-- failure into a successful write, which is the whole point.
--
-- crm_service_businesses and the four Crm* tables were all confirmed to hold
-- zero rows, so nothing here can collide with existing data.
--
-- ─── DELIBERATELY NOT INCLUDED ────────────────────────────────────────────────
--
-- `prisma migrate diff` also proposes DROP CONSTRAINT on foreign keys, DROP
-- INDEX, and tightening nullability across Appointment, Invoice, FeeAssessment,
-- CrmActivity, CrmDeal and CrmFile. That is ordinary accumulated drift rather
-- than breakage, and shipping it alongside a fix for absent columns would be an
-- unreviewed change to live tables. It is left for its own migration.

-- ─── crm_service_businesses ───────────────────────────────────────────────────
--
-- `slug` backs the public handle (pabandi.com/p/<slug>) and `serviceCatalog`
-- holds the provisional service list captured at onboarding. Both are written
-- by onboarding.routes.ts, so both were failing.

ALTER TABLE "crm_service_businesses" ADD COLUMN IF NOT EXISTS "slug"           TEXT;
ALTER TABLE "crm_service_businesses" ADD COLUMN IF NOT EXISTS "serviceCatalog" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "crm_service_businesses_slug_key" ON "crm_service_businesses"("slug");

-- ─── CRM tables: the serviceBusinessId tenant anchor ─────────────────────────
--
-- The unified business-OS migration added a serviceBusinessId to these models so
-- the CRM can hang off CrmServiceBusiness rather than Business. The columns were
-- never added, so every write that set them failed.

ALTER TABLE "CrmActivity" ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;
ALTER TABLE "CrmDeal"     ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;
ALTER TABLE "CrmFile"     ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;
ALTER TABLE "crm_alerts"  ADD COLUMN IF NOT EXISTS "businessId"        TEXT;

CREATE INDEX IF NOT EXISTS "CrmActivity_serviceBusinessId_idx" ON "CrmActivity"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "CrmDeal_serviceBusinessId_idx"     ON "CrmDeal"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "CrmFile_serviceBusinessId_idx"     ON "CrmFile"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_alerts_businessId_idx"         ON "crm_alerts"("businessId");

-- ─── Fee assessment ───────────────────────────────────────────────────────────
--
-- `FeeAssessment.statementId` links an assessment to the statement that collects
-- it. Without it the link is unqueryable, so a collected fee cannot be tied back
-- to the assessment that raised it.

ALTER TABLE "FeeAssessment" ADD COLUMN IF NOT EXISTS "statementId" TEXT;

CREATE INDEX IF NOT EXISTS "FeeAssessment_statementId_idx" ON "FeeAssessment"("statementId");

-- ─── Merchant fee statements ──────────────────────────────────────────────────
--
-- These three record what happened when a statement was sent to Square. Without
-- them a sent statement is indistinguishable from an unsent one, which is the
-- failure the reconciliation work in 20261002_fee_assessment was about.

ALTER TABLE "MerchantFeeStatement" ADD COLUMN IF NOT EXISTS "paymentLink"      TEXT;
ALTER TABLE "MerchantFeeStatement" ADD COLUMN IF NOT EXISTS "sentAt"           TIMESTAMP(3);
ALTER TABLE "MerchantFeeStatement" ADD COLUMN IF NOT EXISTS "squareInvoiceId"  TEXT;