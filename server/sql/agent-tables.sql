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
