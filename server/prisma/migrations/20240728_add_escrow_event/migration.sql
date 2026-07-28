-- Create table for escrow events

CREATE TABLE IF NOT EXISTS "EscrowEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "checkoutSessionId" TEXT NOT NULL,
  "escrowTransactionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for fast lookup
CREATE INDEX IF NOT EXISTS "EscrowEvent_escrowTransactionId_idx" ON "EscrowEvent"("escrowTransactionId");
CREATE INDEX IF NOT EXISTS "EscrowEvent_checkoutSessionId_idx" ON "EscrowEvent"("checkoutSessionId");
