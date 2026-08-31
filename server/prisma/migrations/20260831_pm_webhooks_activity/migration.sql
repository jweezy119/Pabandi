-- Webhooks
CREATE TABLE IF NOT EXISTS "PropertyWebhook" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT '{"all"}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastDeliveredAt" TIMESTAMP(3),
  "lastStatus" TEXT,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyWebhook_pkey" PRIMARY KEY ("id")
);

-- Activity log
CREATE TABLE IF NOT EXISTS "PropertyActivity" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "actorEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyActivity_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PropertyWebhook_managerId_idx" ON "PropertyWebhook"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyActivity_managerId_idx" ON "PropertyActivity"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyActivity_entityType_entityId_idx" ON "PropertyActivity"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "PropertyActivity_createdAt_idx" ON "PropertyActivity"("createdAt");

-- Foreign keys
ALTER TABLE "PropertyWebhook" ADD CONSTRAINT "PropertyWebhook_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyActivity" ADD CONSTRAINT "PropertyActivity_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
