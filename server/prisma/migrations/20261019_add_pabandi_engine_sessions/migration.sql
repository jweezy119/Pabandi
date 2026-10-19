-- Pabandi Engine: session abstraction.
--
-- An "open tab" -- a limit authorised once, spent repeatedly without a further
-- signature per action. See the model comments in schema.prisma for the full
-- rationale.
--
-- Generated with `prisma migrate diff` against a scratch database loaded from
-- the previous schema, so the names below are exactly the ones Prisma emits.
-- `migrate dev` cannot produce them: migration
-- 20260829_add_agent_learning_and_app_integration fails on any fresh shadow
-- database because it ALTERs a "Project" table that does not exist there.

-- CreateTable
CREATE TABLE "PabandiSession" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ephemeralKey" TEXT NOT NULL,
    "totalLimit" DOUBLE PRECISION NOT NULL,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settledTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PabandiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionReceipt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PabandiSession_ephemeralKey_key" ON "PabandiSession"("ephemeralKey");

-- CreateIndex
CREATE INDEX "PabandiSession_ownerType_ownerId_idx" ON "PabandiSession"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "PabandiSession_status_expiresAt_idx" ON "PabandiSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SessionReceipt_sessionId_createdAt_idx" ON "SessionReceipt"("sessionId", "createdAt");

-- The unique index is what makes a retried action idempotent. Note that NULL
-- idempotency keys are exempt (Postgres treats NULLs as distinct), so actions
-- sent without a key are not deduplicated -- by design, since the caller has
-- told us nothing to deduplicate on.
CREATE UNIQUE INDEX "SessionReceipt_sessionId_idempotencyKey_key" ON "SessionReceipt"("sessionId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "SessionReceipt" ADD CONSTRAINT "SessionReceipt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PabandiSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;