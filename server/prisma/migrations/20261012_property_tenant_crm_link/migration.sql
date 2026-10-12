-- Link a property tenant to the CRM client for the same person.
--
-- Until now the two were the same human held in two tables with nothing joining
-- them: PropertyTenant and CrmClient. Every read that needed both fell back to
-- comparing email strings, which is not a constraint and silently returns the
-- wrong person the moment an address changes.
--
-- Both columns are nullable so no existing row needs backfilling, and
-- crmClientId is UNIQUE so "the tenant for this client" can never be ambiguous.
-- The FK is ON DELETE SET NULL: deleting a client record should orphan a tenant,
-- not delete a landlord's tenancy history and rent payments with it.

ALTER TABLE "PropertyTenant"
  ADD COLUMN "crmClientId" TEXT;

CREATE UNIQUE INDEX "PropertyTenant_crmClientId_key"
  ON "PropertyTenant"("crmClientId");

CREATE INDEX "PropertyTenant_crmClientId_idx"
  ON "PropertyTenant"("crmClientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTenant_crmClientId_fkey'
  ) THEN
    ALTER TABLE "PropertyTenant"
      ADD CONSTRAINT "PropertyTenant_crmClientId_fkey"
      FOREIGN KEY ("crmClientId") REFERENCES "CrmClient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
