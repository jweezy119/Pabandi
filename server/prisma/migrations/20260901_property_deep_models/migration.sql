-- Property units
CREATE TABLE IF NOT EXISTS "PropertyUnit" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitNumber" TEXT NOT NULL,
  "bedrooms" INTEGER NOT NULL DEFAULT 1,
  "bathrooms" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "sqft" INTEGER,
  "rentAmount" DOUBLE PRECISION,
  "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'VACANT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id")
);

-- Rent payments
CREATE TABLE IF NOT EXISTS "RentPayment" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "tenantEmail" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "method" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- Property inspections
CREATE TABLE IF NOT EXISTS "PropertyInspection" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "inspector" TEXT,
  "condition" TEXT NOT NULL DEFAULT 'GOOD',
  "notes" TEXT,
  "findings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyInspection_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PropertyUnit_propertyId_idx" ON "PropertyUnit"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyUnit_status_idx" ON "PropertyUnit"("status");
CREATE INDEX IF NOT EXISTS "RentPayment_propertyId_idx" ON "RentPayment"("propertyId");
CREATE INDEX IF NOT EXISTS "RentPayment_tenantEmail_idx" ON "RentPayment"("tenantEmail");
CREATE INDEX IF NOT EXISTS "RentPayment_status_idx" ON "RentPayment"("status");
CREATE INDEX IF NOT EXISTS "RentPayment_dueDate_idx" ON "RentPayment"("dueDate");
CREATE INDEX IF NOT EXISTS "PropertyInspection_propertyId_idx" ON "PropertyInspection"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyInspection_inspectedAt_idx" ON "PropertyInspection"("inspectedAt");

-- Foreign keys
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyInspection" ADD CONSTRAINT "PropertyInspection_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
