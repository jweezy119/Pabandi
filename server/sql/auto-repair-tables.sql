-- Idempotent DDL for Agentic Auto Repair vertical (Vehicle, RepairOrder, Business TrustScore sub-metrics)

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "fairPriceScore" DOUBLE PRECISION NOT NULL DEFAULT 85.0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "communicationScore" DOUBLE PRECISION NOT NULL DEFAULT 85.0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RepairOrderStatus') THEN
    CREATE TYPE "RepairOrderStatus" AS ENUM (
      'CHECKED_IN',
      'INSPECTING',
      'NEEDS_APPROVAL',
      'PENDING_MANUAL_REVIEW',
      'IN_PROGRESS',
      'READY'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "clientId" TEXT,
  "vin" TEXT NOT NULL,
  "year" INTEGER,
  "make" TEXT,
  "model" TEXT,
  "licensePlate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Vehicle_vin_idx" ON "Vehicle"("vin");
CREATE INDEX IF NOT EXISTS "Vehicle_clientId_idx" ON "Vehicle"("clientId");
CREATE INDEX IF NOT EXISTS "Vehicle_businessId_idx" ON "Vehicle"("businessId");

CREATE TABLE IF NOT EXISTS "RepairOrder" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "clientPhone" TEXT,
  "clientName" TEXT,
  "serviceType" TEXT,
  "status" "RepairOrderStatus" NOT NULL DEFAULT 'CHECKED_IN',
  "itemizedEstimate" JSONB,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "depositPaid" BOOLEAN NOT NULL DEFAULT false,
  "isBookedByAgent" BOOLEAN NOT NULL DEFAULT false,
  "fairPriceVerified" BOOLEAN NOT NULL DEFAULT false,
  "fairPriceReport" JSONB,
  "dviPhotos" JSONB,
  "visionProofHash" TEXT,
  "visionProofReport" JSONB,
  "auditLog" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RepairOrder_businessId_idx" ON "RepairOrder"("businessId");
CREATE INDEX IF NOT EXISTS "RepairOrder_vehicleId_idx" ON "RepairOrder"("vehicleId");
CREATE INDEX IF NOT EXISTS "RepairOrder_status_idx" ON "RepairOrder"("status");
