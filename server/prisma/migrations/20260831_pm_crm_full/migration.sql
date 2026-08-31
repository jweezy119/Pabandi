-- Appointments
CREATE TABLE IF NOT EXISTS "PropertyAppointment" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "tenantEmail" TEXT NOT NULL,
  "tenantName" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "reminded" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyAppointment_pkey" PRIMARY KEY ("id")
);

-- Leases
CREATE TABLE IF NOT EXISTS "PropertyLease" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "tenantEmail" TEXT NOT NULL,
  "tenantName" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "rentPeriod" TEXT NOT NULL DEFAULT 'MONTH',
  "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyLease_pkey" PRIMARY KEY ("id")
);

-- Maintenance
CREATE TABLE IF NOT EXISTS "PropertyMaintenance" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "propertyId" TEXT,
  "tenantEmail" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyMaintenance_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PropertyAppointment_managerId_idx" ON "PropertyAppointment"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyAppointment_startsAt_idx" ON "PropertyAppointment"("startsAt");
CREATE INDEX IF NOT EXISTS "PropertyAppointment_status_idx" ON "PropertyAppointment"("status");
CREATE INDEX IF NOT EXISTS "PropertyLease_managerId_idx" ON "PropertyLease"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyLease_tenantEmail_idx" ON "PropertyLease"("tenantEmail");
CREATE INDEX IF NOT EXISTS "PropertyLease_status_idx" ON "PropertyLease"("status");
CREATE INDEX IF NOT EXISTS "PropertyMaintenance_managerId_idx" ON "PropertyMaintenance"("managerId");
CREATE INDEX IF NOT EXISTS "PropertyMaintenance_status_idx" ON "PropertyMaintenance"("status");
CREATE INDEX IF NOT EXISTS "PropertyMaintenance_priority_idx" ON "PropertyMaintenance"("priority");

-- Foreign keys
ALTER TABLE "PropertyAppointment" ADD CONSTRAINT "PropertyAppointment_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyLease" ADD CONSTRAINT "PropertyLease_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMaintenance" ADD CONSTRAINT "PropertyMaintenance_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
