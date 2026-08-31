-- Add meetup fields to LocalSaleEscrow (SafeMeet)
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLocation" TEXT;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLat" DOUBLE PRECISION;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupLng" DOUBLE PRECISION;
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupAt" TIMESTAMP(3);
ALTER TABLE "LocalSaleEscrow" ADD COLUMN IF NOT EXISTS "meetupStatus" TEXT;

-- Property Manager CRM models
CREATE TABLE IF NOT EXISTS "PropertyManagerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyName" TEXT,
  "slug" TEXT,
  "domain" TEXT,
  "brandColor" TEXT,
  "logoUrl" TEXT,
  "tagline" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyManagerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyManagerProperty" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "title" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "zip" TEXT,
  "country" TEXT NOT NULL DEFAULT 'United States',
  "bedrooms" INTEGER NOT NULL DEFAULT 1,
  "bathrooms" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "rentAmount" DOUBLE PRECISION,
  "rentPeriod" TEXT NOT NULL DEFAULT 'MONTH',
  "status" TEXT NOT NULL DEFAULT 'VACANT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyManagerProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyTenant" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROSPECT',
  "riskBand" TEXT,
  "depositHeld" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalStays" INTEGER NOT NULL DEFAULT 0,
  "totalDisputes" INTEGER NOT NULL DEFAULT 0,
  "lastStayAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyTenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyScreening" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "tenantEmail" TEXT NOT NULL,
  "tenantName" TEXT,
  "band" TEXT NOT NULL DEFAULT 'LOW',
  "depositAdjPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'COURTLISTENER',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyScreening_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyManagerProfile_userId_key" ON "PropertyManagerProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyManagerProfile_slug_key" ON "PropertyManagerProfile"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyManagerProfile_domain_key" ON "PropertyManagerProfile"("domain");
CREATE INDEX IF NOT EXISTS "PropertyManagerProperty_managerId_idx" ON "PropertyManagerProperty"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyManagerProperty_status_idx" ON "PropertyManagerProperty"("status");
CREATE INDEX IF NOT EXISTS "PropertyTenant_managerId_email_key" ON "PropertyTenant"("managerId", "email");
CREATE INDEX IF NOT EXISTS "PropertyTenant_managerId_idx" ON "PropertyTenant"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyTenant_email_idx" ON "PropertyTenant"("email");
CREATE INDEX IF NOT EXISTS "PropertyScreening_managerId_idx" ON "PropertyScreening"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyScreening_tenantEmail_idx" ON "PropertyScreening"("tenantEmail");

-- Foreign keys
ALTER TABLE "PropertyManagerProfile" ADD CONSTRAINT "PropertyManagerProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyManagerProperty" ADD CONSTRAINT "PropertyManagerProperty_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyTenant" ADD CONSTRAINT "PropertyTenant_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyScreening" ADD CONSTRAINT "PropertyScreening_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
