-- Service Coordinator Module — Commercial Dispatch & Work Orders
--
-- Idempotent: safe on every deploy and every boot.
-- Mirrors Technician, Customer, WorkOrder, WorkOrderAssignment, WorkOrderAttachment, WorkOrderAudit
-- in prisma/schema.prisma.

-- 1. Technician
CREATE TABLE IF NOT EXISTS "Technician" (
  "id"             TEXT NOT NULL,
  "businessId"     TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "phoneEncrypted" TEXT NOT NULL,
  "skills"         TEXT[] DEFAULT ARRAY[]::TEXT[],
  "active"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Technician_businessId_idx" ON "Technician"("businessId");
CREATE INDEX IF NOT EXISTS "Technician_active_idx" ON "Technician"("active");

-- 2. Customer
CREATE TABLE IF NOT EXISTS "Customer" (
  "id"             TEXT NOT NULL,
  "businessId"     TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "email"          TEXT,
  "phoneEncrypted" TEXT,
  "address"        TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Customer_businessId_idx" ON "Customer"("businessId");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");

-- 3. WorkOrder
CREATE TABLE IF NOT EXISTS "WorkOrder" (
  "id"             TEXT NOT NULL,
  "businessId"     TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "priority"       TEXT NOT NULL DEFAULT 'ROUTINE',
  "issueType"      TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "address"        TEXT NOT NULL,
  "accessNotes"    TEXT,
  "scheduledFor"   TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "invoiceStatus"  TEXT NOT NULL DEFAULT 'NOT_READY',
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrder_businessId_idx" ON "WorkOrder"("businessId");
CREATE INDEX IF NOT EXISTS "WorkOrder_customerId_idx" ON "WorkOrder"("customerId");
CREATE INDEX IF NOT EXISTS "WorkOrder_status_idx" ON "WorkOrder"("status");
CREATE INDEX IF NOT EXISTS "WorkOrder_priority_idx" ON "WorkOrder"("priority");

-- 4. WorkOrderAssignment
CREATE TABLE IF NOT EXISTS "WorkOrderAssignment" (
  "id"             TEXT NOT NULL,
  "workOrderId"    TEXT NOT NULL,
  "technicianId"   TEXT NOT NULL,
  "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"     TIMESTAMP(3),
  "declinedAt"     TIMESTAMP(3),
  CONSTRAINT "WorkOrderAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkOrderAssignment_workOrderId_technicianId_key" UNIQUE ("workOrderId", "technicianId")
);

CREATE INDEX IF NOT EXISTS "WorkOrderAssignment_technicianId_idx" ON "WorkOrderAssignment"("technicianId");
CREATE INDEX IF NOT EXISTS "WorkOrderAssignment_workOrderId_idx" ON "WorkOrderAssignment"("workOrderId");

-- 5. WorkOrderAttachment
CREATE TABLE IF NOT EXISTS "WorkOrderAttachment" (
  "id"           TEXT NOT NULL,
  "workOrderId"  TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "url"          TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderAttachment_workOrderId_idx" ON "WorkOrderAttachment"("workOrderId");

-- 6. WorkOrderAudit (Append-only immutable audit trail)
CREATE TABLE IF NOT EXISTS "WorkOrderAudit" (
  "id"          TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "actorId"     TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "before"      JSONB,
  "after"       JSONB,
  "requestId"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkOrderAudit_workOrderId_idx" ON "WorkOrderAudit"("workOrderId");
CREATE INDEX IF NOT EXISTS "WorkOrderAudit_actorId_idx" ON "WorkOrderAudit"("actorId");
CREATE INDEX IF NOT EXISTS "WorkOrderAudit_createdAt_idx" ON "WorkOrderAudit"("createdAt");

-- Foreign key constraints guarded via DO blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Technician_businessId_fkey'
  ) THEN
    ALTER TABLE "Technician" ADD CONSTRAINT "Technician_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_businessId_fkey'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_businessId_fkey'
  ) THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_customerId_fkey'
  ) THEN
    ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderAssignment_workOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkOrderAssignment" ADD CONSTRAINT "WorkOrderAssignment_workOrderId_fkey"
      FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderAssignment_technicianId_fkey'
  ) THEN
    ALTER TABLE "WorkOrderAssignment" ADD CONSTRAINT "WorkOrderAssignment_technicianId_fkey"
      FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderAttachment_workOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkOrderAttachment" ADD CONSTRAINT "WorkOrderAttachment_workOrderId_fkey"
      FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrderAudit_workOrderId_fkey'
  ) THEN
    ALTER TABLE "WorkOrderAudit" ADD CONSTRAINT "WorkOrderAudit_workOrderId_fkey"
      FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE;
  END IF;
END $$;

