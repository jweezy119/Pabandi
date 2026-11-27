-- Custom fields collected in Settings -> Custom Fields are stored on records as JSON.
ALTER TABLE "crm_clients" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmDeal" ADD COLUMN IF NOT EXISTS "customData" JSONB;
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "customData" JSONB;
