-- Trust edge for providers.
--
-- A provider (a named barber, stylist, nurse) earns a passport by delivering,
-- exactly as a customer does. Without this, a customer can only ever see the
-- salon's aggregate history, which is much weaker evidence than "this person has
-- done this for 40 customers and no-showed twice".

ALTER TABLE "BusinessProvider" ADD COLUMN IF NOT EXISTS "passportId" TEXT;

CREATE INDEX IF NOT EXISTS "BusinessProvider_passportId_idx" ON "BusinessProvider"("passportId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessProvider_passportId_fkey'
  ) THEN
    ALTER TABLE "BusinessProvider"
      ADD CONSTRAINT "BusinessProvider_passportId_fkey"
      FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
