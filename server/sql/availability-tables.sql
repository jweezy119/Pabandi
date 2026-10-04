-- CrmAvailability — recurring weekly opening hours.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's preDeployCommand
-- invokes ensure-agent-tables.cjs, which executes the DDL in server/sql directly, and
-- src/utils/tableBootstrap.ts runs the same statements at boot. A table that exists only
-- in a migration folder does not exist in production — the same reason `prisma migrate
-- deploy` cannot rebuild this schema at all (271 of 338 models have no migration; see
-- docs/build-plan.md).
--
-- WHY IT EXISTS
-- The double-booking work added conflict DETECTION: it stops one employee being booked
-- twice. It says nothing about whether a job is inside the hours the business is open,
-- because no model recorded those hours at all — the onboarding wizard collected them and
-- POSTed them to an endpoint that did not exist. This table is that missing record.
--
-- `weekday` is 0-6 with 0 = Sunday, matching JavaScript's getUTCDay() and the wizard's own
-- day keys. Mirrors the CrmAvailability model in prisma/schema.prisma — keep the two in
-- step, and add this filename to SQL_FILES in ensure-agent-tables.cjs.
--
-- Idempotent: safe on every deploy and every boot.

CREATE TABLE IF NOT EXISTS "CrmAvailability" (
  "id"                TEXT        NOT NULL,
  "serviceBusinessId" TEXT        NOT NULL,
  "weekday"           INTEGER     NOT NULL,
  "startTime"         TEXT        NOT NULL,
  "endTime"           TEXT        NOT NULL,
  "slotMinutes"       INTEGER     NOT NULL DEFAULT 60,
  "bufferMinutes"     INTEGER     NOT NULL DEFAULT 15,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmAvailability_pkey" PRIMARY KEY ("id")
);

-- Every read filters by business and weekday; without these the check behind job creation
-- degrades to a sequential scan.
CREATE INDEX IF NOT EXISTS "CrmAvailability_serviceBusinessId_weekday_idx"
  ON "CrmAvailability"("serviceBusinessId", "weekday");

-- Re-running onboarding must replace the previous week rather than accumulate duplicates,
-- so the same business cannot open the same weekday twice.
CREATE UNIQUE INDEX IF NOT EXISTS "CrmAvailability_serviceBusinessId_weekday_startTime_key"
  ON "CrmAvailability"("serviceBusinessId", "weekday", "startTime");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmAvailability_serviceBusinessId_fkey'
  ) THEN
    ALTER TABLE "CrmAvailability" DROP CONSTRAINT "CrmAvailability_serviceBusinessId_fkey";
  END IF;

  ALTER TABLE "CrmAvailability"
    ADD CONSTRAINT "CrmAvailability_serviceBusinessId_fkey"
    FOREIGN KEY ("serviceBusinessId") REFERENCES "CrmServiceBusiness"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
END
$$;

-- The onboarding wizard has always shown the user a "slug" and had nowhere to put one. The
-- legacy AbodeManager.slug belongs to the orphaned Abode-era model that nothing writes to, so
-- the handle lives here instead. Nullable, so a business without one still works.
ALTER TABLE "CrmServiceBusiness" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "CrmServiceBusiness" ADD COLUMN IF NOT EXISTS "serviceCatalog" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'CrmServiceBusiness_slug_key'
  ) THEN
    DROP INDEX "CrmServiceBusiness_slug_key";
  END IF;
  CREATE UNIQUE INDEX "CrmServiceBusiness_slug_key" ON "CrmServiceBusiness"("slug");
END
$$;
