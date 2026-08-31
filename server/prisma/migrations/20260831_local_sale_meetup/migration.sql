-- SafeMeet: add meetup tracking fields to LocalSaleEscrow
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLocation" TEXT;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLat" DOUBLE PRECISION;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLng" DOUBLE PRECISION;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupAt" TIMESTAMP(3);
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupStatus" TEXT;
