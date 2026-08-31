-- Create enum SaleStatus only if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SaleStatus') THEN
    CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'VERIFIED', 'FUNDED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
  END IF;
END
$$;

-- Create LocalSaleEscrow table only if it does not already exist.
CREATE TABLE IF NOT EXISTS "LocalSaleEscrow" (
  "id" TEXT NOT NULL,
  "referralCode" TEXT,
  "listingUrl" TEXT,
  "itemTitle" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "sellerEmail" TEXT NOT NULL,
  "buyerEmail" TEXT,
  "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
  "txHash" TEXT,
  "simulated" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LocalSaleEscrow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LocalSaleEscrow_referralCode_idx" ON "LocalSaleEscrow"("referralCode");
CREATE INDEX IF NOT EXISTS "LocalSaleEscrow_status_idx" ON "LocalSaleEscrow"("status");
