-- Agent onboarding tables.
-- "AgentMarketplace" backs agent signup, API-key auth, passport issuance and
-- the discovery manifests, but it was never in a Prisma migration. Without it
-- every agent call fails with `relation "AgentMarketplace" does not exist`
-- while the routes themselves look healthy.
-- Idempotent: safe to run on every boot and every deploy.
CREATE TABLE IF NOT EXISTS "AgentMarketplace" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "ownerEmail" TEXT,
  "displayName" TEXT,
  description TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "completedTasks" INTEGER NOT NULL DEFAULT 0,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  "apiKeyHash" TEXT,
  "walletAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMarketplace_apiKeyHash_key" ON "AgentMarketplace" ("apiKeyHash") WHERE "apiKeyHash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "AgentMarketplace_ownerEmail_idx" ON "AgentMarketplace" ("ownerEmail");
CREATE INDEX IF NOT EXISTS "AgentMarketplace_status_idx" ON "AgentMarketplace" ("status");

-- Ensure User.preferredMode column exists for Business <-> Personal mode switching
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredMode" TEXT NOT NULL DEFAULT 'business';

-- Project Simulator tables ("ProjectSimulation" and "SimulationAgentRun")
CREATE TABLE IF NOT EXISTS "ProjectSimulation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "projectType" TEXT NOT NULL,
  "initialFactors" JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  "finalEstimate" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ProjectSimulation_userId_idx" ON "ProjectSimulation" ("userId");
CREATE INDEX IF NOT EXISTS "ProjectSimulation_status_idx" ON "ProjectSimulation" (status);

CREATE TABLE IF NOT EXISTS "SimulationAgentRun" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "simulationId" TEXT NOT NULL REFERENCES "ProjectSimulation"(id) ON DELETE CASCADE,
  "agentRole" TEXT NOT NULL,
  "inputPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "outputPayload" JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  "executionTimeMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_simulationId_idx" ON "SimulationAgentRun" ("simulationId");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_agentRole_idx" ON "SimulationAgentRun" ("agentRole");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_status_idx" ON "SimulationAgentRun" (status);
