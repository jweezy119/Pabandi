-- Migration: add_pab_economy_and_verification
-- Created: 2026-09-02
-- Purpose: Add PAB economy tables and verificationCode to User

-- 1. Add verificationCode to User (if not exists)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationCodeExpires" TIMESTAMP(3);

-- 2. Create PabWallet table
CREATE TABLE IF NOT EXISTS "PabWallet" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalBurned" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stakedAmt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stakedTier" TEXT,
  "stakedAt" TIMESTAMP(3),
  "stakeExpires" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PabWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PabWallet_userId_key" ON "PabWallet"("userId");

-- 3. Create PabTransaction table
CREATE TABLE IF NOT EXISTS "PabTransaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "walletId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "refType" TEXT,
  "refId" TEXT,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PabTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PabWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PabTransaction_walletId_idx" ON "PabTransaction"("walletId");
CREATE INDEX IF NOT EXISTS "PabTransaction_type_idx" ON "PabTransaction"("type");
CREATE INDEX IF NOT EXISTS "PabTransaction_action_idx" ON "PabTransaction"("action");

-- 4. Create PabEarnRule table
CREATE TABLE IF NOT EXISTS "PabEarnRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "cooldownHours" INTEGER NOT NULL DEFAULT 0,
  "dailyCap" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabEarnRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PabEarnRule_action_key" ON "PabEarnRule"("action");

-- 5. Create PabSpendRule table
CREATE TABLE IF NOT EXISTS "PabSpendRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "action" TEXT NOT NULL,
  "cost" DOUBLE PRECISION NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabSpendRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PabSpendRule_action_key" ON "PabSpendRule"("action");

-- 6. Create PabStakeTier table
CREATE TABLE IF NOT EXISTS "PabStakeTier" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "tier" TEXT NOT NULL,
  "minStake" DOUBLE PRECISION NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "benefit" TEXT NOT NULL,
  "feeDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "searchBoost" BOOLEAN NOT NULL DEFAULT false,
  "badge" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabStakeTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PabStakeTier_tier_key" ON "PabStakeTier"("tier");

-- 7. Create PabTreasury table
CREATE TABLE IF NOT EXISTS "PabTreasury" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "totalSolEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalSolToPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPabBurned" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPabStaked" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "poolSolBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "poolUsdcBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PabTreasury_pkey" PRIMARY KEY ("id")
);
