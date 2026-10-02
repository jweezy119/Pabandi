-- Fee assessment: fees Pabandi has earned and not yet collected.
--
-- WHY THIS IS AN ACCRUAL RATHER THAN A DEDUCTION
-- Deposits and invoice payments settle into the *merchant's own* Square account
-- (resolveSquareCredentials prefers the merchant token over the platform token).
-- The money never passes through Pabandi, so there is no percentage to take at the
-- point of charge. Anything that deducted the fee from the customer's payment
-- would only work while the platform-token fallback was in use, and would silently
-- stop taking money on the day a merchant connected their own account — which is
-- the outcome we want.
--
-- So a FeeAssessment row is an accounts-receivable entry, written when the charge
-- is created and collected on a later MerchantFeeStatement.

-- WHY EVERY RATE IS STORED, NOT JUST THE FEE
-- rateBps, tier, category and the breakdown are frozen at assessment time. If the
-- schedule changes next month, a fee quoted in March must still reconcile to what
-- the merchant was billed in March. Recomputing from current rates would rewrite
-- history and produce a number nobody can explain — including, eventually, us.
--
-- marginCents is stored as well as feeCents. They differ by exactly the processing
-- cost, and only one of them is the business's result. Keeping both means a
-- subsidised transaction is visible in the ledger instead of having to be
-- re-derived and noticed later.

-- WHY idempotencyKey IS UNIQUE
-- Invoices get re-sent, deposit links get regenerated, and Square replays webhooks.
-- None of those may bill a merchant twice for one appointment. A read-then-write
-- check in application code races — two concurrent sends both see "no assessment"
-- and both insert. A unique index makes the second attempt fail at the database,
-- so the race is unwinnable rather than merely unlikely.
CREATE TABLE IF NOT EXISTS "FeeAssessment" (
  "id" TEXT NOT NULL,
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

-- Statements: fees accumulate here rather than being emailed per transaction,
-- which is also what makes the free-transaction allowance countable in charges
-- instead of dates. Nothing reads this table yet; it exists so the collection
-- cycle has somewhere to write when it is built.
CREATE TABLE IF NOT EXISTS "MerchantFeeStatement" (
  "id" TEXT NOT NULL,
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

-- Idempotency key. See above.
CREATE UNIQUE INDEX IF NOT EXISTS "FeeAssessment_idempotencyKey_key"
  ON "FeeAssessment"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantFeeStatement_number_key"
  ON "MerchantFeeStatement"("number");

-- The collection cycle's primary query: everything owed by one merchant.
CREATE INDEX IF NOT EXISTS "FeeAssessment_businessId_status_idx"
  ON "FeeAssessment"("businessId", "status");

-- Looking up the fee for a specific charge without scanning.
CREATE INDEX IF NOT EXISTS "FeeAssessment_sourceType_sourceId_idx"
  ON "FeeAssessment"("sourceType", "sourceId");

-- Period reporting.
CREATE INDEX IF NOT EXISTS "FeeAssessment_createdAt_idx"
  ON "FeeAssessment"("createdAt");

CREATE INDEX IF NOT EXISTS "MerchantFeeStatement_businessId_status_idx"
  ON "MerchantFeeStatement"("businessId", "status");

-- ON DELETE CASCADE: fees are an accounting record of this business's activity.
-- Deleting a business removes its obligations along with it, which is correct for
-- a test tenant and wrong for a real one — but a real deletion should be a
-- retention decision, not something this constraint decides silently.
ALTER TABLE "FeeAssessment"
  ADD CONSTRAINT "FeeAssessment_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MerchantFeeStatement"
  ADD CONSTRAINT "MerchantFeeStatement_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
