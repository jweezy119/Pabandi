-- Reconciliation tables.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's
-- preDeployCommand invokes ensure-agent-tables.cjs, which executes the DDL in
-- this file directly, and src/utils/tableBootstrap.ts runs the same statements
-- at boot. A table that exists only in a migration folder is a table that does
-- not exist in production, and the symptom is every reconciliation webhook
-- failing with `relation "ReconciliationMatch" does not exist` while the
-- routes look healthy.
--
-- Idempotent: safe to run on every deploy and every boot. Mirrors
-- prisma/migrations/20261001_reconciliation_matches/migration.sql — keep the two
-- in step.

CREATE TABLE IF NOT EXISTS "ReconciliationMatch" (
  id TEXT NOT NULL,
  "invoiceId" TEXT,
  "paymentRef" TEXT NOT NULL,
  "rail" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "candidates" JSONB,
  "note" TEXT,
  "matchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id"),
  -- ON DELETE SET NULL, so deleting an invoice leaves the payment record
  -- intact: an orphan row is real money that arrived, and losing it would
  -- hide revenue.
  CONSTRAINT "ReconciliationMatch_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- paymentRef is the webhook idempotency key. Rails redeliver webhooks with the
-- same reference, so this constraint is what makes a redelivery a no-op
-- instead of a second settlement. Do not drop it.
CREATE UNIQUE INDEX IF NOT EXISTS "ReconciliationMatch_paymentRef_key"
  ON "ReconciliationMatch" ("paymentRef");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_invoiceId_idx"
  ON "ReconciliationMatch" ("invoiceId");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_status_idx"
  ON "ReconciliationMatch" ("status");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_createdAt_idx"
  ON "ReconciliationMatch" ("createdAt");
