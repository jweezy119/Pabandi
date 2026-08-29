-- Add missing columns
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- New tables
CREATE TABLE IF NOT EXISTS "AgentIteration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "deployed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgentFeedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL UNIQUE,
  "agentId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgentBooking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fromAgentId" TEXT NOT NULL,
  "toAgentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amountPab" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feeSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AppConnection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appName" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "bearerToken" TEXT,
  "webhookUrl" TEXT,
  "redirectUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for learning queries
CREATE INDEX IF NOT EXISTS "AgentIteration_agentId_idx" ON "AgentIteration"("agentId");
CREATE INDEX IF NOT EXISTS "AgentIteration_deployed_idx" ON "AgentIteration"("deployed");
CREATE INDEX IF NOT EXISTS "AgentFeedback_agentId_idx" ON "AgentFeedback"("agentId");
CREATE INDEX IF NOT EXISTS "AgentFeedback_rating_idx" ON "AgentFeedback"("rating");
CREATE INDEX IF NOT EXISTS "AgentBooking_fromAgentId_idx" ON "AgentBooking"("fromAgentId");
CREATE INDEX IF NOT EXISTS "AgentBooking_toAgentId_idx" ON "AgentBooking"("toAgentId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_appId_status_idx" ON "WebhookDelivery"("appId", "status");
