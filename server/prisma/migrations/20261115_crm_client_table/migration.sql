CREATE TABLE IF NOT EXISTS "CrmClient" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stage" TEXT DEFAULT 'LEAD',
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastJobAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "passportId" TEXT,
    CONSTRAINT "CrmClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmClient_passportId_key" ON "CrmClient"("passportId");
CREATE INDEX IF NOT EXISTS "CrmClient_businessId_idx" ON "CrmClient"("businessId");
CREATE INDEX IF NOT EXISTS "CrmClient_name_idx" ON "CrmClient"("name");
