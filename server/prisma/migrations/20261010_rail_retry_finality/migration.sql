-- Retry accounting and settlement finality on ReconciliationMatch.
--
-- ─── WHY THIS IS ADDITIVE AND NOT A REPLACEMENT ───────────────────────────────
-- ReconciliationMatch is the one row that says "a payment arrived, and here is
-- what it turned out to be". It is the natural home for both of these, because
-- both are facts about a payment attempt rather than about an invoice: an
-- invoice can have several attempts, and they can each fail differently.
--
-- Nothing here replaces an existing column. `status` still carries the
-- matched/queued/orphan outcome, `paymentRef` is still the idempotency key,
-- and the settlement columns sit ALONGSIDE `matchedAt` rather than
-- reinterpret it. `matchedAt` records when we decided; `settlementStatus`
-- records whether that decision could still be undone.
--
-- ─── WHY RETRY IS PER-paymentRef AND NOT PER-INVOICE ──────────────────────────
-- An invoice may be attempted on Square, fail, retried on PayPal, fail, retried
-- on Solana, and succeed. If retryCount lived on the Invoice, that whole history
-- would collapse into "3 attempts" with no way to say which rail each belonged
-- to or whether the third one is still inside its budget. Scoping to
-- paymentRef keeps each attempt independent and makes `originalRail` /
-- `lastRetryRail` meaningful as a difference rather than two copies of one value.

ALTER TABLE "ReconciliationMatch" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReconciliationMatch" ADD COLUMN "originalRail" TEXT;
ALTER TABLE "ReconciliationMatch" ADD COLUMN "lastRetryRail" TEXT;
ALTER TABLE "ReconciliationMatch" ADD COLUMN "lastFailureReason" TEXT;
ALTER TABLE "ReconciliationMatch" ADD COLUMN "failureKind" TEXT;

ALTER TABLE "ReconciliationMatch" ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ReconciliationMatch" ADD COLUMN "settlesAt" TIMESTAMP(3);

CREATE INDEX "ReconciliationMatch_settlementStatus_settlesAt_idx"
  ON "ReconciliationMatch"("settlementStatus", "settlesAt");

-- ─── BACKFILL, AND WHY IT IS NOT A NO-OP ─────────────────────────────────────
-- Every existing row predates finality tracking, so the column default labels
-- them all 'pending' with no settlesAt. That is wrong for the two rail types
-- that can never be reversed, and wrong in the direction that matters: an
-- already-matched Solana payment has been sitting in this table reported as
-- provisional when it was final the moment it was confirmed.
--
-- On-chain settlements get 'settled' with a null settlesAt — already final, no
-- window to wait out. Everything else keeps 'pending', which is the safe
-- direction: it claims less certainty than the row can support.
--
-- A NULL settlesAt on a fiat row stays a known gap rather than a fabricated
-- date. Deriving one from `matchedAt` would invent a chargeback deadline for
-- payments that may have been made years ago, and a wrong deadline is worse
-- than an absent one — it would release escrow early.
UPDATE "ReconciliationMatch"
SET "settlementStatus" = 'settled'
WHERE "rail" = 'solana' AND "status" = 'matched';