-- Agent API keys: raw key is shown once, only the SHA-256 hash is stored.
CREATE TABLE "AgentApiKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "agentId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spendLimitUsd" DOUBLE PRECISION,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentApiKey_keyHash_key" ON "AgentApiKey"("keyHash");
CREATE INDEX "AgentApiKey_ownerUserId_idx" ON "AgentApiKey"("ownerUserId");
CREATE INDEX "AgentApiKey_agentId_idx" ON "AgentApiKey"("agentId");

-- Public, non-secret proof that a worker was paid for a completed booking.
CREATE TABLE "PaidProof" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rail" TEXT,
    "txHash" TEXT,
    "receiptRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaidProof_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaidProof_publicId_key" ON "PaidProof"("publicId");
CREATE UNIQUE INDEX "PaidProof_bookingId_key" ON "PaidProof"("bookingId");
CREATE INDEX "PaidProof_workerId_idx" ON "PaidProof"("workerId");
