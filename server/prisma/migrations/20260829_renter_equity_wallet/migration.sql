-- Renter Equity Wallet + Rent Stream tables (Trust-As-Infrastructure: rent → yield)
CREATE TABLE IF NOT EXISTS "RenterEquityWallet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantEquity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "landlordBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalSettled" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RenterEquityWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RenterEquityWallet_userId_key" ON "RenterEquityWallet"("userId");
CREATE INDEX IF NOT EXISTS "RenterEquityWallet_userId_idx" ON "RenterEquityWallet"("userId");

CREATE TABLE IF NOT EXISTS "RentStream" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "propertyId" TEXT,
  "rentAmountUSD" DOUBLE PRECISION NOT NULL,
  "pool" TEXT NOT NULL DEFAULT 'ONDO_USDC',
  "expectedApy" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  "holdingDays" INTEGER NOT NULL DEFAULT 4,
  "totalYieldUSD" DOUBLE PRECISION,
  "tenantEquityUSD" DOUBLE PRECISION,
  "landlordBonusUSD" DOUBLE PRECISION,
  "pabandiSpreadUSD" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "simulated" BOOLEAN NOT NULL DEFAULT true,
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RentStream_tenantId_idx" ON "RentStream"("tenantId");
CREATE INDEX IF NOT EXISTS "RentStream_landlordId_idx" ON "RentStream"("landlordId");
CREATE INDEX IF NOT EXISTS "RentStream_status_idx" ON "RentStream"("status");
