-- CrmTask — Contact OS tasks.
--
-- WHY THIS IS RAW SQL AND NOT A PRISMA MIGRATION ALONE
-- Nothing in the deploy path runs `prisma migrate deploy`. Render's preDeployCommand
-- invokes ensure-agent-tables.cjs, which executes the DDL in server/sql directly, and
-- src/utils/tableBootstrap.ts runs the same statements at boot. A table that exists only
-- in a migration folder does not exist in production.
--
-- Idempotent: safe on every deploy and every boot. Mirrors the CrmTask model in
-- prisma/schema.prisma — keep the two in step, and add this filename to SQL_FILES in
-- ensure-agent-tables.cjs and tableBootstrap.ts.

CREATE TABLE IF NOT EXISTS "CrmTask" (
    "id"                TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "description"       TEXT,
    "status"            TEXT NOT NULL DEFAULT 'TODO',
    "priority"          TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate"           TIMESTAMPTZ,
    "clientId"          TEXT,
    "dealId"            TEXT,
    "assignedTo"        TEXT,
    "businessId"        TEXT,
    "serviceBusinessId" TEXT,
    "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CrmTask_serviceBusinessId_idx" ON "CrmTask"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "CrmTask_businessId_idx" ON "CrmTask"("businessId");
CREATE INDEX IF NOT EXISTS "CrmTask_status_idx" ON "CrmTask"("status");
