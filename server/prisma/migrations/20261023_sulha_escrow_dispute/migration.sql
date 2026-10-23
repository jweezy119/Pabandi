-- Sulha (Optimistic Arbitration): escrow disputes.
--
-- A dispute on an escrow is a distinct record from the resident reservation-jury
-- `Dispute` table: different counterparties, a different state machine, and a
-- freeze that must be honoured by the Pabandi Engine closeSession path. See the
-- model comments in schema.prisma for the full rationale.
--
-- Generated against the schema by hand in the style of
-- 20261019_add_pabandi_engine_sessions (which documents why `migrate dev`
-- cannot be the generator here), so the emitted names match what Prisma
-- produces for this exact shape.
--
-- sanity: expected to apply cleanly against the previous migration set.

-- CreateTable
CREATE TABLE "EscrowDispute" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "raisedByPassport" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiConfidence" DOUBLE PRECISION,
    "resolutionNotes" TEXT,
    "sessionId" TEXT,
    "panelVotes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EscrowDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscrowDispute_escrowId_key" ON "EscrowDispute"("escrowId");

-- CreateIndex
CREATE INDEX "EscrowDispute_status_createdAt_idx" ON "EscrowDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EscrowDispute_sessionId_idx" ON "EscrowDispute"("sessionId");
