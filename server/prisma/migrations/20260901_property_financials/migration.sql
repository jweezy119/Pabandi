-- Enhanced lease terms
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "petFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "petMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "lateFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "lateGraceDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "utilities" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "renewalTerms" TEXT;
ALTER TABLE "PropertyLease" ADD COLUMN IF NOT EXISTS "terminationNoticeDays" INTEGER NOT NULL DEFAULT 30;

-- Maintenance cost tracking
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION;
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "vendorNotes" TEXT;

-- Property financials (income/expense tracking)
CREATE TABLE IF NOT EXISTS "PropertyFinancial" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  // Transaction details.
  "type" TEXT NOT NULL, // INCOME | EXPENSE
  "category" TEXT NOT NULL, // RENT | LATE_FEE | PET_FEE | MAINTENANCE | UTILITY | INSURANCE | TAX | MORTGAGE | OTHER
  "amount" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "tenantEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyFinancial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PropertyFinancial_propertyId_idx" ON "PropertyFinancial"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyFinancial_date_idx" ON "PropertyFinancial"("date");
CREATE INDEX IF NOT EXISTS "PropertyFinancial_type_idx" ON "PropertyFinancial"("type");
