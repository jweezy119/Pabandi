-- CrmDeal.serviceBusinessId — anchor deals to the current tenant.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's preDeployCommand
-- invokes ensure-agent-tables.cjs, which executes the DDL in server/sql directly, and
-- src/utils/tableBootstrap.ts runs the same statements at boot. A column that exists only
-- in a migration folder does not exist in production — the same reason
-- `prisma migrate deploy` cannot rebuild this schema at all (271 of 338 models have no
-- migration; see docs/build-plan.md).
--
-- THE BUG THIS FIXES
-- CrmDeal was reachable only through the legacy CrmBusiness, and there is no path from
-- CrmServiceBusiness to CrmBusiness. So /api/v1/crm/deals, scoped the way every other CRM
-- endpoint is scoped, matched nothing for a correctly enrolled business: the deals pages
-- rendered empty. CrmClient already carries both ids; this brings CrmDeal into line.
--
-- Nullable with no backfill: existing deals stay exactly as they are and remain visible to
-- a caller holding the matching CrmBusiness via the existing businessId column. Nothing is
-- dropped, and `db push` applies the identical change.
--
-- Idempotent: safe on every deploy and every boot. Mirrors the CrmDeal model in
-- prisma/schema.prisma — keep the two in step, and add this filename to SQL_FILES in
-- ensure-agent-tables.cjs.

ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;

-- CrmDeal.businessId is relaxed to nullable for the same reason: a deal created in
-- personal mode has no platform Business yet, and a NOT NULL here would make personal-mode
-- deal creation impossible. Existing rows keep their value.
ALTER TABLE "CrmDeal" ALTER COLUMN "businessId" DROP NOT NULL;

-- Every read filters on this, so it needs its own index. Without it the deals list
-- degrades to a sequential scan as soon as a business has a few thousand rows.
CREATE INDEX IF NOT EXISTS "CrmDeal_serviceBusinessId_idx" ON "CrmDeal"("serviceBusinessId");

-- A deal is deleted with its service business (matches the Prisma onDelete: Cascade).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmDeal_serviceBusinessId_fkey'
  ) THEN
    ALTER TABLE "CrmDeal" DROP CONSTRAINT "CrmDeal_serviceBusinessId_fkey";
  END IF;

  ALTER TABLE "CrmDeal"
    ADD CONSTRAINT "CrmDeal_serviceBusinessId_fkey"
    FOREIGN KEY ("serviceBusinessId") REFERENCES "CrmServiceBusiness"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
END
$$;

-- CrmActivity.serviceBusinessId — the same anchor for activity metrics.
--
-- An activity can be reached through its client or deal, but a standalone note has
-- neither, and those were the rows the activity report silently dropped: it filtered on the
-- legacy CrmBusiness id, which a correctly enrolled tenant does not have.
--
-- Nullable, no backfill, idempotent — same reasoning as CrmDeal above.

ALTER TABLE "CrmActivity" ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;
ALTER TABLE "CrmActivity" ALTER COLUMN "businessId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "CrmActivity_serviceBusinessId_idx" ON "CrmActivity"("serviceBusinessId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmActivity_serviceBusinessId_fkey'
  ) THEN
    ALTER TABLE "CrmActivity" DROP CONSTRAINT "CrmActivity_serviceBusinessId_fkey";
  END IF;

  ALTER TABLE "CrmActivity"
    ADD CONSTRAINT "CrmActivity_serviceBusinessId_fkey"
    FOREIGN KEY ("serviceBusinessId") REFERENCES "CrmServiceBusiness"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
END
$$;
