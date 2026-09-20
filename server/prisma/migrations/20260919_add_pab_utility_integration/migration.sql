-- Create PAB Utility Integration tables

-- StakingRecord model
CREATE TABLE "StakingRecord" (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    tier TEXT NOT NULL,
    "amountPab" DOUBLE PRECISION NOT NULL,
    "trustBoost" INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    "stakedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "unlockAt" TIMESTAMP(3) NOT NULL,
    "unstakedAt" TIMESTAMP(3),
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "StakingRecord_pkey" PRIMARY KEY (id)
);

CREATE INDEX "StakingRecord_userId_idx" ON "StakingRecord"("userId");
CREATE INDEX "StakingRecord_status_idx" ON "StakingRecord"(status);
CREATE INDEX "StakingRecord_tier_idx" ON "StakingRecord"(tier);

-- BookingPabRecord model
CREATE TABLE "BookingPabRecord" (
    id TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingValue" DOUBLE PRECISION NOT NULL,
    "depositPab" DOUBLE PRECISION NOT NULL,
    "rewardPab" DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    "businessId" TEXT,
    "checkinAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BookingPabRecord_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "BookingPabRecord_bookingId_key" ON "BookingPabRecord"("bookingId");
CREATE INDEX "BookingPabRecord_userId_idx" ON "BookingPabRecord"("userId");
CREATE INDEX "BookingPabRecord_status_idx" ON "BookingPabRecord"(status);
CREATE INDEX "BookingPabRecord_businessId_idx" ON "BookingPabRecord"("businessId");

-- AgentReward model
CREATE TABLE "AgentReward" (
    id TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT,
    "taskType" TEXT NOT NULL,
    "taskValue" DOUBLE PRECISION NOT NULL,
    "rewardPab" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT,
    status TEXT DEFAULT 'PENDING',
    "distributedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AgentReward_pkey" PRIMARY KEY (id)
);

CREATE INDEX "AgentReward_agentId_idx" ON "AgentReward"("agentId");
CREATE INDEX "AgentReward_userId_idx" ON "AgentReward"("userId");
CREATE INDEX "AgentReward_status_idx" ON "AgentReward"(status);

-- Add fields to User table
ALTER TABLE "User" ADD COLUMN "pabStaked" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "pabEarned" DOUBLE PRECISION DEFAULT 0;

-- Add relations
ALTER TABLE "StakingRecord" ADD CONSTRAINT "StakingRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "BookingPabRecord" ADD CONSTRAINT "BookingPabRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;

ALTER TABLE "BookingPabRecord" ADD CONSTRAINT "BookingPabRecord_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE SET NULL;

ALTER TABLE "AgentReward" ADD CONSTRAINT "AgentReward_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
