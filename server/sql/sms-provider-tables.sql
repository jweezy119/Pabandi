-- BusinessSmsProvider — bring-your-own SMS credentials.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's preDeployCommand
-- invokes ensure-agent-tables.cjs, which executes the DDL in server/sql directly, and
-- src/utils/tableBootstrap.ts runs the same statements at boot. A table that exists only
-- in a migration folder does not exist in production — which is the same reason
-- `prisma migrate deploy` cannot rebuild this schema at all (271 of 338 models have no
-- migration; see docs/build-plan.md).
--
-- Idempotent: safe on every deploy and every boot. Mirrors the BusinessSmsProvider model
-- in prisma/schema.prisma — keep the two in step, and add this filename to SQL_FILES in
-- ensure-agent-tables.cjs.

CREATE TABLE IF NOT EXISTS "BusinessSmsProvider" (
  "id"             TEXT        NOT NULL,
  "businessId"     TEXT        NOT NULL,
  "provider"       TEXT        NOT NULL,
  -- AES-256-GCM blob (`iv:authTag:ciphertext`). Never a plaintext secret, never
  -- selected into an API response.
  "credentials"    TEXT        NOT NULL,
  "fromNumber"     TEXT        NOT NULL,
  -- PENDING until verified against the provider, then VERIFIED or FAILED.
  "status"         TEXT        NOT NULL DEFAULT 'PENDING',
  "lastError"      TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSmsProvider_pkey" PRIMARY KEY ("id")
);

-- One provider per business. Enforced by a unique index rather than only by the schema:
-- the deploy hook is raw SQL, so the database has to carry the invariant itself.
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_key" ON "BusinessSmsProvider"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_idx" ON "BusinessSmsProvider"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_status_idx" ON "BusinessSmsProvider"("status");

-- The FK is added separately and guarded, because a business created before this table
-- existed has no row here, and re-running the statement would otherwise fail with
-- "relation already exists" and break every subsequent deploy.
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
END $$;
