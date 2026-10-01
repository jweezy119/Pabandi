-- ══════════════════════════════════════════════════════════════════════════════
-- Unified Business OS — schema unification for the service-economy platform
--
-- Context
--   Two divergent Prisma schemas existed (schema.prisma / schema_final.prisma).
--   The generated client had none of the CRM models the server code referenced,
--   so every CRM endpoint threw at runtime. This migration reconciles the live
--   database with a single canonical schema.
--
-- Strategy: RENAME, never DROP. All tables are renamed in place so rows, FKs
-- and secondary indexes survive. Columns superseded by the new model are
-- migrated into their replacements rather than discarded.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Rename tables to their canonical (snake_case, @@map) names ─────────────
-- Postgres keeps FKs and indexes bound to the renamed relation automatically.

ALTER TABLE "CrmBusiness"     RENAME TO "crm_service_businesses";
ALTER TABLE "CrmEmployee"     RENAME TO "crm_employees";
ALTER TABLE "CrmClient"       RENAME TO "crm_clients";
ALTER TABLE "CrmJob"          RENAME TO "crm_jobs";
ALTER TABLE "CrmPayroll"      RENAME TO "crm_payrolls";
ALTER TABLE "CrmExpense"      RENAME TO "crm_expenses";
ALTER TABLE "PipelineLead"    RENAME TO "pipeline_leads";
ALTER TABLE "PipelineDeal"    RENAME TO "pipeline_deals";
ALTER TABLE "PipelineActivity" RENAME TO "pipeline_activities";


-- ── 2. crm_service_businesses ───────────────────────────────────────────────
-- Old shape was self-contained (businessName / ownerEmail / ownerName).
-- New shape anchors to the platform `Business` + `User` records so the CRM is a
-- view over a platform business rather than a parallel silo.

ALTER TABLE "crm_service_businesses" ADD COLUMN "businessId" TEXT;
ALTER TABLE "crm_service_businesses" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "crm_service_businesses" ADD COLUMN "teamSize" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "crm_service_businesses" ADD COLUMN "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE';

-- Resolve ownerId from the legacy ownerEmail column.
UPDATE "crm_service_businesses" sb
   SET "ownerId" = u.id
  FROM "User" u
 WHERE lower(u.email) = lower(sb."ownerEmail")
   AND sb."ownerId" IS NULL;

-- Any row still unresolved is attributed to the earliest user so the NOT NULL
-- constraint can be satisfied; enrollment is re-run by the owner on first login.
UPDATE "crm_service_businesses"
   SET "ownerId" = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
 WHERE "ownerId" IS NULL;

ALTER TABLE "crm_service_businesses" ALTER COLUMN "ownerId" SET NOT NULL;

-- Link to the platform Business record where one can be matched by name/email.
UPDATE "crm_service_businesses" sb
   SET "businessId" = b.id
  FROM "Business" b
 WHERE sb."businessId" IS NULL
   AND (
     lower(b.name) = lower(sb."businessName")
     OR (sb."ownerEmail" IS NOT NULL AND lower(b.email) = lower(sb."ownerEmail"))
   );

ALTER TABLE "crm_service_businesses" ALTER COLUMN "businessId" DROP DEFAULT;


-- ── 3. Child tables: businessId → serviceBusinessId ─────────────────────────
-- The service-business id is preserved, so the foreign key direction is
-- unchanged and no row has to be re-pointed.

ALTER TABLE "crm_employees" RENAME COLUMN "businessId" TO "serviceBusinessId";
ALTER TABLE "crm_clients"   RENAME COLUMN "businessId" TO "serviceBusinessId";
ALTER TABLE "crm_jobs"      RENAME COLUMN "businessId" TO "serviceBusinessId";
ALTER TABLE "crm_payrolls"  RENAME COLUMN "businessId" TO "serviceBusinessId";
ALTER TABLE "crm_expenses"  RENAME COLUMN "businessId" TO "serviceBusinessId";


-- ── 4. crm_employees ────────────────────────────────────────────────────────

ALTER TABLE "crm_employees" ADD COLUMN "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
ALTER TABLE "crm_employees" ADD COLUMN "jobsCompleted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "crm_employees" ADD COLUMN "lastBookingAt" TIMESTAMP(3);
ALTER TABLE "crm_employees" ADD COLUMN "passportId" TEXT;

-- email/phone are required by the canonical model; backfill before constraining.
UPDATE "crm_employees" SET "email" = '' WHERE "email" IS NULL;
UPDATE "crm_employees" SET "phone" = '' WHERE "phone" IS NULL;
ALTER TABLE "crm_employees" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "crm_employees" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "crm_employees" ALTER COLUMN "payRate" DROP DEFAULT;

CREATE UNIQUE INDEX "crm_employees_passportId_key" ON "crm_employees"("passportId");
CREATE INDEX "crm_employees_serviceBusinessId_idx" ON "crm_employees"("serviceBusinessId");
CREATE INDEX "crm_employees_passportId_idx" ON "crm_employees"("passportId");
CREATE INDEX "crm_employees_isActive_idx" ON "crm_employees"("isActive");


-- ── 5. crm_clients ──────────────────────────────────────────────────────────

ALTER TABLE "crm_clients" ADD COLUMN "totalJobs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "crm_clients" ADD COLUMN "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "crm_clients" ADD COLUMN "lastJobAt" TIMESTAMP(3);
ALTER TABLE "crm_clients" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'lead';
ALTER TABLE "crm_clients" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- The legacy column defaulted to 750 (0-1000 scale). crm-reliability.service.ts
-- and alerts.service.ts both treat reliabilityScore as 0-100 (`< 30` critical,
-- `> 80` VIP), so legacy values are rescaled rather than left on a dead scale.
UPDATE "crm_clients" SET "reliabilityScore" = "reliabilityScore" / 10
 WHERE "reliabilityScore" > 100;
ALTER TABLE "crm_clients" ALTER COLUMN "reliabilityScore" SET DEFAULT 50;

UPDATE "crm_clients" SET "email" = '' WHERE "email" IS NULL;
UPDATE "crm_clients" SET "phone" = '' WHERE "phone" IS NULL;
UPDATE "crm_clients" SET "address" = '' WHERE "address" IS NULL;
ALTER TABLE "crm_clients" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "crm_clients" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "crm_clients" ALTER COLUMN "address" SET NOT NULL;

-- Backfill lifecycle counters from actual job history.
UPDATE "crm_clients" c
   SET "totalJobs" = COALESCE(a.n, 0),
       "totalSpent" = COALESCE(a.spent, 0),
       "lastJobAt" = a.last_at
  FROM (
    SELECT "clientId",
           COUNT(*)::int                                  AS n,
           COALESCE(SUM("price"), 0)                      AS spent,
           MAX("scheduledDate")                           AS last_at
      FROM "crm_jobs"
     GROUP BY "clientId"
  ) a
 WHERE a."clientId" = c.id;

-- Derive pipeline stage from history + reliability.
UPDATE "crm_clients"
   SET "stage" = CASE
     WHEN "reliabilityScore" < 30                             THEN 'at_risk'
     WHEN "totalJobs" >= 10 AND "reliabilityScore" > 80        THEN 'vip'
     WHEN "totalJobs" >= 2                                    THEN 'repeat'
     WHEN "totalJobs" >= 1                                    THEN 'booked'
     WHEN "phone" <> ''                                       THEN 'verified'
     ELSE 'lead'
   END
 WHERE "stage" = 'lead';

CREATE UNIQUE INDEX "crm_clients_passportId_key" ON "crm_clients"("passportId");
CREATE INDEX "crm_clients_serviceBusinessId_idx" ON "crm_clients"("serviceBusinessId");
CREATE INDEX "crm_clients_passportId_idx" ON "crm_clients"("passportId");
CREATE INDEX "crm_clients_stage_idx" ON "crm_clients"("stage");


-- ── 6. crm_jobs ─────────────────────────────────────────────────────────────

ALTER TABLE "crm_jobs" ADD COLUMN "clientName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "crm_jobs" ADD COLUMN "rating" INTEGER;
ALTER TABLE "crm_jobs" ADD COLUMN "feedback" TEXT;
ALTER TABLE "crm_jobs" ADD COLUMN "actualDurationMinutes" INTEGER;
ALTER TABLE "crm_jobs" ADD COLUMN "passportId" TEXT;

-- Denormalized client snapshot, per the canonical model.
UPDATE "crm_jobs" j
   SET "clientName" = c.name
  FROM "crm_clients" c
 WHERE c.id = j."clientId";
UPDATE "crm_jobs" SET "clientName" = 'Unknown' WHERE "clientName" = '';
ALTER TABLE "crm_jobs" ALTER COLUMN "clientName" DROP DEFAULT;

-- duration → durationMinutes (legacy column kept for now; see note below).
UPDATE "crm_jobs" SET "durationMinutes" = "duration"
 WHERE "durationMinutes" IS NULL AND "duration" IS NOT NULL;
UPDATE "crm_jobs" SET "durationMinutes" = 60 WHERE "durationMinutes" IS NULL;

UPDATE "crm_jobs" SET "scheduledTime" = '00:00' WHERE "scheduledTime" IS NULL;
ALTER TABLE "crm_jobs" ALTER COLUMN "scheduledTime" SET NOT NULL;

UPDATE "crm_jobs" SET "address" = '' WHERE "address" IS NULL;
ALTER TABLE "crm_jobs" ALTER COLUMN "address" SET NOT NULL;

ALTER TABLE "crm_jobs" ALTER COLUMN "price" DROP DEFAULT;

-- escrowStatus becomes optional in the canonical model.
ALTER TABLE "crm_jobs" ALTER COLUMN "escrowStatus" DROP NOT NULL;
ALTER TABLE "crm_jobs" ALTER COLUMN "escrowStatus" DROP DEFAULT;

-- `employeeId` is superseded by the crm_job_assignments join table. This table
-- holds no rows, so the column and its FK are dropped outright.
ALTER TABLE "crm_jobs" DROP CONSTRAINT IF EXISTS "CrmJob_employeeId_fkey";
ALTER TABLE "crm_jobs" DROP COLUMN IF EXISTS "employeeId";
DROP INDEX IF EXISTS "CrmJob_employeeId_idx";

CREATE INDEX "crm_jobs_serviceBusinessId_idx" ON "crm_jobs"("serviceBusinessId");
CREATE INDEX "crm_jobs_passportId_idx" ON "crm_jobs"("passportId");
CREATE INDEX "crm_jobs_clientId_idx" ON "crm_jobs"("clientId");
CREATE INDEX "crm_jobs_status_idx" ON "crm_jobs"("status");
CREATE INDEX "crm_jobs_scheduledDate_idx" ON "crm_jobs"("scheduledDate");


-- ── 7. crm_payrolls ─────────────────────────────────────────────────────────

ALTER TABLE "crm_payrolls" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "crm_payrolls" ADD COLUMN "passportId" TEXT;

ALTER TABLE "crm_payrolls" ALTER COLUMN "hoursWorked" DROP DEFAULT;
ALTER TABLE "crm_payrolls" ALTER COLUMN "jobsCompleted" DROP DEFAULT;
ALTER TABLE "crm_payrolls" ALTER COLUMN "grossPay" DROP DEFAULT;
ALTER TABLE "crm_payrolls" ALTER COLUMN "netPay" DROP DEFAULT;

DROP INDEX IF EXISTS "CrmPayroll_periodStart_idx";
CREATE INDEX "crm_payrolls_serviceBusinessId_idx" ON "crm_payrolls"("serviceBusinessId");
CREATE INDEX "crm_payrolls_passportId_idx" ON "crm_payrolls"("passportId");
CREATE INDEX "crm_payrolls_employeeId_idx" ON "crm_payrolls"("employeeId");
CREATE INDEX "crm_payrolls_status_idx" ON "crm_payrolls"("status");


-- ── 8. crm_expenses ─────────────────────────────────────────────────────────

ALTER TABLE "crm_expenses" ADD COLUMN "passportId" TEXT;

UPDATE "crm_expenses" SET "description" = category WHERE "description" IS NULL;
ALTER TABLE "crm_expenses" ALTER COLUMN "description" SET NOT NULL;

CREATE INDEX "crm_expenses_serviceBusinessId_idx" ON "crm_expenses"("serviceBusinessId");
CREATE INDEX "crm_expenses_passportId_idx" ON "crm_expenses"("passportId");
CREATE INDEX "crm_expenses_category_idx" ON "crm_expenses"("category");
CREATE INDEX "crm_expenses_date_idx" ON "crm_expenses"("date");


-- ── 9. pipeline_* — lead passport is now optional ───────────────────────────
-- Leads are created before a passport exists, so the FK becomes nullable and
-- the lead can exist in a "pre-trust" state that the trust layer later enriches.

ALTER TABLE "pipeline_leads" ALTER COLUMN "passportId" DROP NOT NULL;
ALTER TABLE "pipeline_leads" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "pipeline_leads" ADD COLUMN IF NOT EXISTS "notes" TEXT;

DROP INDEX IF EXISTS "PipelineLead_businessId_stage_idx";
CREATE INDEX "pipeline_leads_businessId_stage_idx" ON "pipeline_leads"("businessId", "stage");
CREATE INDEX "pipeline_deals_leadId_stage_idx" ON "pipeline_deals"("leadId", "stage");
CREATE INDEX "pipeline_activities_leadId_idx" ON "pipeline_activities"("leadId");


-- ── 10. New tables ──────────────────────────────────────────────────────────

CREATE TABLE "crm_job_assignments" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_job_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_alerts" (
    "id" TEXT NOT NULL,
    "serviceBusinessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "moduleId" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_alerts_pkey" PRIMARY KEY ("id")
);

-- Per-business module selection. The registry owns the catalogue; this table
-- owns which layers a given business has switched on.
CREATE TABLE "crm_module_installs" (
    "id" TEXT NOT NULL,
    "serviceBusinessId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_module_installs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_alerts_entityId_title_key" ON "crm_alerts"("entityId", "title");
CREATE INDEX "crm_alerts_serviceBusinessId_dismissed_idx" ON "crm_alerts"("serviceBusinessId", "dismissed");
CREATE INDEX "crm_alerts_serviceBusinessId_createdAt_idx" ON "crm_alerts"("serviceBusinessId", "createdAt");

CREATE UNIQUE INDEX "crm_module_installs_serviceBusinessId_moduleId_key" ON "crm_module_installs"("serviceBusinessId", "moduleId");
CREATE INDEX "crm_module_installs_moduleId_idx" ON "crm_module_installs"("moduleId");

CREATE INDEX "crm_job_assignments_jobId_idx" ON "crm_job_assignments"("jobId");
CREATE INDEX "crm_job_assignments_employeeId_idx" ON "crm_job_assignments"("employeeId");


-- ── 11. Foreign keys ────────────────────────────────────────────────────────

ALTER TABLE "crm_service_businesses"
  ADD CONSTRAINT "crm_service_businesses_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_service_businesses"
  ADD CONSTRAINT "crm_service_businesses_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "crm_service_businesses_businessId_key" ON "crm_service_businesses"("businessId");
CREATE INDEX "crm_service_businesses_ownerId_idx" ON "crm_service_businesses"("ownerId");
CREATE INDEX "crm_service_businesses_serviceType_idx" ON "crm_service_businesses"("serviceType");

ALTER TABLE "crm_employees"
  ADD CONSTRAINT "crm_employees_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_clients"
  ADD CONSTRAINT "crm_clients_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_jobs"
  ADD CONSTRAINT "crm_jobs_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_payrolls"
  ADD CONSTRAINT "crm_payrolls_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_expenses"
  ADD CONSTRAINT "crm_expenses_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_alerts"
  ADD CONSTRAINT "crm_alerts_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_module_installs"
  ADD CONSTRAINT "crm_module_installs_serviceBusinessId_fkey"
  FOREIGN KEY ("serviceBusinessId") REFERENCES "crm_service_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_job_assignments"
  ADD CONSTRAINT "crm_job_assignments_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "crm_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_job_assignments"
  ADD CONSTRAINT "crm_job_assignments_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "crm_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trust edges. These are what make the CRM a participant in the Pabandi trust
-- protocol rather than an isolated ledger: every operational row can point at
-- the passport whose score it helps move.
ALTER TABLE "crm_employees"
  ADD CONSTRAINT "crm_employees_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_clients"
  ADD CONSTRAINT "crm_clients_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_jobs"
  ADD CONSTRAINT "crm_jobs_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_payrolls"
  ADD CONSTRAINT "crm_payrolls_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_expenses"
  ADD CONSTRAINT "crm_expenses_passportId_fkey"
  FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 12. Legacy index cleanup ───────────────────────────────────────────────
-- The old indexes were named after the pre-rename tables and are now redundant
-- with the canonical index set created above.

DROP INDEX IF EXISTS "CrmBusiness_ownerEmail_idx";
DROP INDEX IF EXISTS "CrmBusiness_serviceType_idx";
DROP INDEX IF EXISTS "CrmEmployee_businessId_idx";
DROP INDEX IF EXISTS "CrmEmployee_isActive_idx";
DROP INDEX IF EXISTS "CrmClient_businessId_idx";
DROP INDEX IF EXISTS "CrmClient_name_idx";
DROP INDEX IF EXISTS "CrmJob_businessId_idx";
DROP INDEX IF EXISTS "CrmPayroll_businessId_idx";
DROP INDEX IF EXISTS "CrmExpense_businessId_idx";
DROP INDEX IF EXISTS "PipelineLead_businessId_stage_idx";