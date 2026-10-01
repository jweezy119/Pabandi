-- ReconciliationMatch: one row per inbound rail payment we tried to match to
-- an invoice.
--
-- WHY paymentRef IS UNIQUE
-- This constraint is the webhook idempotency key. Rails redeliver webhooks
-- (Square retries on any non-2xx, PayPal retries for up to 72h), always with
-- the same payment reference. A read-then-write check in application code would
-- race: two concurrent deliveries both see "no match exists" and both settle
-- the invoice, firing the trust event twice and crediting referral fees twice.
-- A unique index makes the second insert fail at the database instead, so the
-- race is unwinnable rather than merely unlikely.
--
-- WHY invoiceId IS NULLABLE
-- An orphan payment is real money that arrived with no matching invoice. If
-- invoiceId were required, the only way to record that money would be to
-- delete it — which is precisely the case a business most needs to see. The
-- finance team resolves the orphan from this table.
--
-- amount is Decimal(18,6) rather than Float: this column is the record of what
-- a customer actually paid. Binary floating point cannot represent 0.10 or
-- 19.99 exactly, and a reconciliation table that is off by fractions of a cent
-- is a reconciliation table nobody trusts.

CREATE TABLE IF NOT EXISTS "ReconciliationMatch" (
  "id" TEXT NOT NULL,
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

-- Idempotency key. See above.
CREATE UNIQUE INDEX IF NOT EXISTS "ReconciliationMatch_paymentRef_key"
  ON "ReconciliationMatch"("paymentRef");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_invoiceId_idx"
  ON "ReconciliationMatch"("invoiceId");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_status_idx"
  ON "ReconciliationMatch"("status");

CREATE INDEX IF NOT EXISTS "ReconciliationMatch_createdAt_idx"
  ON "ReconciliationMatch"("createdAt");
