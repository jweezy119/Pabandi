-- Manual migration: add recommendation engine tables (AgentStake, Project, ProjectBid).
-- Hand-written to avoid the schema drift (rentalType / PassportIssuance) present in full db push.
-- Mirrors prisma/schema.prisma models exactly.

CREATE TABLE IF NOT EXISTS "AgentStake" (
  "id"         TEXT NOT NULL,
  "agentId"    TEXT NOT NULL,
  "amountPab"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "slashedPab" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "vault"      TEXT NOT NULL,
  "indexed"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentStake_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentStake_agentId_key" ON "AgentStake"("agentId");
CREATE INDEX IF NOT EXISTS "AgentStake_agentId_idx" ON "AgentStake"("agentId");
CREATE INDEX IF NOT EXISTS "AgentStake_indexed_idx" ON "AgentStake"("indexed");
ALTER TABLE "AgentStake" ADD CONSTRAINT "AgentStake_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Web3Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Project" (
  "id"               TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT NOT NULL,
  "category"        TEXT NOT NULL,
  "requiredSkills"   TEXT[],
  "budgetUsd"       DOUBLE PRECISION NOT NULL,
  "estimatedHours"  INTEGER NOT NULL DEFAULT 0,
  "demandGrowthPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'OPEN',
  "vaultUsdc"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "yieldEarnedUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bestAgentId"     TEXT,
  "bestConfidence"  DOUBLE PRECISION,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "Project_category_idx" ON "Project"("category");

CREATE TABLE IF NOT EXISTS "ProjectBid" (
  "id"             TEXT NOT NULL,
  "projectId"      TEXT NOT NULL,
  "agentId"        TEXT NOT NULL,
  "confidencePct"  DOUBLE PRECISION NOT NULL,
  "quoteUsd"       DOUBLE PRECISION NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "breakdown"      JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectBid_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectBid_projectId_idx" ON "ProjectBid"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectBid_agentId_idx" ON "ProjectBid"("agentId");
ALTER TABLE "ProjectBid" ADD CONSTRAINT "ProjectBid_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
