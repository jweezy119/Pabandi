-- CrmFile.serviceBusinessId — the last table in this family without a tenant anchor.
--
-- WHY
-- `CrmFile.businessId` was a REQUIRED foreign key to `CrmBusiness`, and NOTHING creates a
-- CrmBusiness row: enrollment only ever makes a `CrmServiceBusiness`. So the table was
-- structurally unwriteable and `GET /crm/files` could never return a row for a real tenant.
-- The read had been scoped through `client.serviceBusinessId` as a workaround, which was
-- correct but meant a file could not exist independently of the client relation.
--
-- This is the same fix already applied to CrmDeal, CrmActivity and (in the previous commit)
-- the settings table: give the model the anchor that actually resolves.
--
-- Nullable, no backfill, nothing dropped: rows written before this have only the legacy
-- `businessId`, and reads below match those through the client relation so they stay visible.
--
-- Idempotent: safe on every deploy and every boot. Mirrors the CrmFile model in
-- prisma/schema.prisma — keep the two in step, and add this filename to SQL_FILES in
-- ensure-agent-tables.cjs.

ALTER TABLE "CrmFile" ADD COLUMN IF NOT EXISTS "serviceBusinessId" TEXT;
ALTER TABLE "CrmFile" ALTER COLUMN "businessId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "CrmFile_serviceBusinessId_idx" ON "CrmFile"("serviceBusinessId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CrmFile_serviceBusinessId_fkey'
  ) THEN
    ALTER TABLE "CrmFile" DROP CONSTRAINT "CrmFile_serviceBusinessId_fkey";
  END IF;

  ALTER TABLE "CrmFile"
    ADD CONSTRAINT "CrmFile_serviceBusinessId_fkey"
    FOREIGN KEY ("serviceBusinessId") REFERENCES "CrmServiceBusiness"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
END
$$;
