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
