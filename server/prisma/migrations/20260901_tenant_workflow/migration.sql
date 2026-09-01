-- Tenant applications
CREATE TABLE IF NOT EXISTS "TenantApplication" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "phone" TEXT,
  "message" TEXT,
  "desiredMoveIn" TIMESTAMP(3),
  "monthlyIncome" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "screeningBand" TEXT,
  "screeningId" TEXT,
  "depositAdjPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "decisionNotes" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantApplication_pkey" PRIMARY KEY ("id")
);

-- Tenant documents
CREATE TABLE IF NOT EXISTS "TenantDocument" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "tenantEmail" TEXT,
  "applicationId" TEXT,
  "leaseId" TEXT,
  "title" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "mimeType" TEXT,
  "category" TEXT NOT NULL DEFAULT 'OTHER',
  "uploadedBy" TEXT NOT NULL DEFAULT 'TENANT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "TenantApplication_managerId_idx" ON "TenantApplication"("managerId");
CREATE INDEX IF NOT EXISTS "TenantApplication_email_idx" ON "TenantApplication"("email");
CREATE INDEX IF NOT EXISTS "TenantApplication_status_idx" ON "TenantApplication"("status");
CREATE INDEX IF NOT EXISTS "TenantDocument_managerId_idx" ON "TenantDocument"("managerId");
CREATE INDEX IF NOT EXISTS "TenantDocument_tenantEmail_idx" ON "TenantDocument"("tenantEmail");
CREATE INDEX IF NOT EXISTS "TenantDocument_category_idx" ON "TenantDocument"("category");

-- Foreign keys
ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
