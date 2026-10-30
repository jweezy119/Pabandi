-- Escrow fee collection: add businessId, userId, platformFeeAmount, platformFeeStatus.
--
-- These columns are required for payment.service.ts to persist the platform fee
-- on escrow release. Without them the platform fee is calculated but never
-- stored, and the escrow update throws a Prisma runtime error.
--
-- All four columns are nullable and purely additive: existing rows keep their
-- values, and on Aliyun RDS each ADD COLUMN is a single metadata-only statement.

ALTER TABLE "Escrow" ADD COLUMN "businessId" TEXT;
ALTER TABLE "Escrow" ADD COLUMN "userId" TEXT;
ALTER TABLE "Escrow" ADD COLUMN "platformFeeAmount" DOUBLE PRECISION;
ALTER TABLE "Escrow" ADD COLUMN "platformFeeStatus" TEXT DEFAULT 'NONE';

CREATE INDEX "Escrow_businessId_idx" ON "Escrow"("businessId");
CREATE INDEX "Escrow_userId_idx" ON "Escrow"("userId");
