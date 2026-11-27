-- Custom fields collected in Settings -> Custom Fields are stored on records as JSON.
ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "customData" JSONB;

-- Saved views for CRM object lists (filters/sorts/columns as JSON).
CREATE TABLE IF NOT EXISTS "CrmSavedView" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "userId" TEXT,
  "objectType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB,
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmSavedView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmSavedView_businessId_objectType_idx" ON "CrmSavedView"("businessId", "objectType");
CREATE INDEX IF NOT EXISTS "CrmSavedView_userId_objectType_idx" ON "CrmSavedView"("userId", "objectType");

CREATE TABLE IF NOT EXISTS "CrmCompany" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "industry" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "customData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCompany_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmCompany_serviceBusinessId_idx" ON "CrmCompany"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "CrmCompany_name_idx" ON "CrmCompany"("name");

CREATE TABLE IF NOT EXISTS "CrmNote" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "clientId" TEXT,
  "dealId" TEXT,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmNote_serviceBusinessId_clientId_idx" ON "CrmNote"("serviceBusinessId", "clientId");
CREATE INDEX IF NOT EXISTS "CrmNote_dealId_idx" ON "CrmNote"("dealId");

CREATE TABLE IF NOT EXISTS "CrmComment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmComment_entityType_entityId_idx" ON "CrmComment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "CrmComment_serviceBusinessId_idx" ON "CrmComment"("serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmAutomationRule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "triggerObject" TEXT NOT NULL,
  "triggerEvent" TEXT NOT NULL,
  "conditions" JSONB,
  "actions" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmAutomationRule_serviceBusinessId_triggerObject_idx" ON "CrmAutomationRule"("serviceBusinessId", "triggerObject");
