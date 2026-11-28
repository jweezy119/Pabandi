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

-- Metadata layer: custom objects, their fields, records, and the builder game.
CREATE TABLE IF NOT EXISTS "CrmObjectDefinition" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "name" TEXT NOT NULL,
  "pluralName" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'pentagon',
  "color" TEXT NOT NULL DEFAULT '#C97B5A',
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmObjectDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmObjectDefinition_serviceBusinessId_idx" ON "CrmObjectDefinition"("serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmFieldDefinition" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmFieldDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmFieldDefinition_objectId_idx" ON "CrmFieldDefinition"("objectId");

CREATE TABLE IF NOT EXISTS "CrmCustomRecord" (
  "id" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "businessId" TEXT,
  "serviceBusinessId" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCustomRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmCustomRecord_objectId_serviceBusinessId_idx" ON "CrmCustomRecord"("objectId", "serviceBusinessId");

CREATE TABLE IF NOT EXISTS "CrmBuilderProgress" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "badges" JSONB,
  "milestones" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmBuilderProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmBuilderProgress_businessId_key" ON "CrmBuilderProgress"("businessId");

CREATE TABLE IF NOT EXISTS "CrmBlueprintTemplate" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT NOT NULL DEFAULT '✨',
  "color" TEXT NOT NULL DEFAULT '#C97B5A',
  "data" JSONB NOT NULL,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmBlueprintTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmBlueprintTemplate_isPublic_idx" ON "CrmBlueprintTemplate"("isPublic");
CREATE INDEX IF NOT EXISTS "CrmBlueprintTemplate_businessId_idx" ON "CrmBlueprintTemplate"("businessId");

CREATE TABLE IF NOT EXISTS "CrmMailAccount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "imapHost" TEXT NOT NULL,
  "imapPort" INTEGER NOT NULL DEFAULT 993,
  "imapSecure" BOOLEAN NOT NULL DEFAULT true,
  "imapUser" TEXT NOT NULL,
  "imapPassword" TEXT NOT NULL,
  "smtpHost" TEXT,
  "smtpPort" INTEGER DEFAULT 587,
  "smtpUser" TEXT,
  "smtpPassword" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmMailAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmMailAccount_businessId_key" ON "CrmMailAccount"("businessId");

CREATE TABLE IF NOT EXISTS "CrmCalendarAccount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Calendar',
  "calendarUrl" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCalendarAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCalendarAccount_businessId_key" ON "CrmCalendarAccount"("businessId");

CREATE TABLE IF NOT EXISTS "CrmAutomationRun" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "businessId" TEXT,
  "event" TEXT NOT NULL,
  "recordId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "actions" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAutomationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmAutomationRun_ruleId_createdAt_idx" ON "CrmAutomationRun"("ruleId", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmWebhookDelivery" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "businessId" TEXT,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmWebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmWebhookDelivery_endpointId_createdAt_idx" ON "CrmWebhookDelivery"("endpointId", "createdAt");
