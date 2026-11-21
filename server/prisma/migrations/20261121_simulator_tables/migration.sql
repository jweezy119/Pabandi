-- Project Simulator tables, restored with the simulator routes.
--
-- These were purged in the core-wedge cleanup along with the routes that used
-- them. The routes had never been mounted, so the landing page, the module
-- switcher and the invoice share links were calling endpoints that 404'd.
--
-- Idempotent, like every other migration here.

CREATE TABLE IF NOT EXISTS "ProjectSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "initialFactors" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "finalEstimate" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ProjectSimulation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectSimulation_userId_idx" ON "ProjectSimulation"("userId");
CREATE INDEX IF NOT EXISTS "ProjectSimulation_status_idx" ON "ProjectSimulation"("status");

CREATE TABLE IF NOT EXISTS "SimulationAgentRun" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "inputPayload" JSONB NOT NULL,
    "outputPayload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executionTimeMs" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "SimulationAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimulationAgentRun_simulationId_idx" ON "SimulationAgentRun"("simulationId");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_agentRole_idx" ON "SimulationAgentRun"("agentRole");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_status_idx" ON "SimulationAgentRun"("status");
