-- Fee assessment tables.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's
-- preDeployCommand invokes ensure-agent-tables.cjs, which executes the DDL in
-- this file directly, and src/utils/tableBootstrap.ts runs the same statements at
-- boot. A table that exists only in a migration folder is a table that does not
-- exist in production, and the symptom is every invoice send failing on
-- `relation "FeeAssessment" does not exist` while the routes look healthy.
--
-- Idempotent: safe on every deploy and every boot. Mirrors
-- prisma/migrations/20261002_fee_assessment/migration.sql — keep the two in step,
-- and add this filename to SQL_FILES in ensure-agent-tables.cjs.

-- WHY THIS IS AN ACCRUAL RATHER THAN A DEDUCTION
-- Deposits and invoice payments settle into the merchant's own Square account
-- (resolveSquareCredentials prefers the merchant token). The money never passes
-- through Pabandi, so there is no percentage to take at the point of charge.
-- Anything deducting the fee from the customer's payment would only work while the
-- platform-token fallback was in use, and would silently stop taking money on the
-- day a merchant connected their own account.
--
-- rateBps, tier, category and breakdown are frozen at assessment time. If the
-- schedule changes next month, a fee quoted in March must still reconcile to what
-- that merchant was billed in March.
CREATE TABLE IF NOT EXISTS "FeeAssessment" (
  id TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "chargeCents" INTEGER NOT NULL,
  "feeCents" INTEGER NOT NULL,
  "processingCents" INTEGER NOT NULL,
  "marginCents" INTEGER NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "tier" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'accrued',
  "breakdown" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "billedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeeAssessment_pkey" PRIMARY KEY ("id")
);

-- Statements: fees accumulate rather than being emailed per transaction, which
-- is also what makes the free-transaction allowance countable in charges instead
-- of dates. Nothing reads this yet; it exists so the collection cycle has
-- somewhere to write.
CREATE TABLE IF NOT EXISTS "MerchantFeeStatement" (
  id TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantFeeStatement_pkey" PRIMARY KEY ("id")
);

-- Idempotency key. Invoices get re-sent, deposit links regenerated, and Square
-- replays webhooks. None may bill a merchant twice for one appointment. A
-- read-then-write check in application code races; this constraint makes the
-- second attempt fail at the database instead. Do not drop it.
CREATE UNIQUE INDEX IF NOT EXISTS "FeeAssessment_idempotencyKey_key"
  ON "FeeAssessment" ("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantFeeStatement_number_key"
  ON "MerchantFeeStatement" ("number");

-- The collection cycle's primary query: everything one merchant owes.
CREATE INDEX IF NOT EXISTS "FeeAssessment_businessId_status_idx"
  ON "FeeAssessment" ("businessId", "status");

-- Looking up the fee for one charge without scanning.
CREATE INDEX IF NOT EXISTS "FeeAssessment_sourceType_sourceId_idx"
  ON "FeeAssessment" ("sourceType", "sourceId");

-- Period reporting.
CREATE INDEX IF NOT EXISTS "FeeAssessment_createdAt_idx"
  ON "FeeAssessment" ("createdAt");

CREATE INDEX IF NOT EXISTS "MerchantFeeStatement_businessId_status_idx"
  ON "MerchantFeeStatement" ("businessId", "status");

-- The foreign keys are added separately and guarded, because ALTER TABLE ADD
-- CONSTRAINT has no IF NOT EXISTS in Postgres. Re-adding would fail every deploy
-- after the first. DO $$ … IF NOT EXISTS (SELECT … FROM pg_constraint) is the
-- standard workaround and is idempotent.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FeeAssessment_businessId_fkey'
  ) THEN
    ALTER TABLE "FeeAssessment"
      ADD CONSTRAINT "FeeAssessment_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MerchantFeeStatement_businessId_fkey'
  ) THEN
    ALTER TABLE "MerchantFeeStatement"
      ADD CONSTRAINT "MerchantFeeStatement_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
