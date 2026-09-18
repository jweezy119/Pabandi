-- Migration: add_property_suite_models
-- Created: 2026-09-17
-- Purpose: Add full property suite models for Airbnb/Apartments.com-like experience

-- 1. PropertyPhoto
CREATE TABLE IF NOT EXISTS "PropertyPhoto" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "url" TEXT NOT NULL,
  "caption" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "mimeType" TEXT,
  "fileSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyPhoto_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyPhoto_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PropertyPhoto_propertyId_idx" ON "PropertyPhoto"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyPhoto_unitId_idx" ON "PropertyPhoto"("unitId");

-- 2. Amenity
CREATE TABLE IF NOT EXISTS "Amenity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "category" TEXT,
  "icon" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Amenity_name_key" UNIQUE ("name")
);
CREATE INDEX IF NOT EXISTS "Amenity_name_idx" ON "Amenity"("name");

-- 3. PropertyAmenity
CREATE TABLE IF NOT EXISTS "PropertyAmenity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "amenityId" TEXT NOT NULL,
  "value" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyAmenity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PropertyAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyAmenity_propertyId_unitId_amenityId_key" ON "PropertyAmenity"("propertyId", "unitId", "amenityId");
CREATE INDEX IF NOT EXISTS "PropertyAmenity_propertyId_idx" ON "PropertyAmenity"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyAmenity_unitId_idx" ON "PropertyAmenity"("unitId");

-- 4. PropertyRatePlan
CREATE TABLE IF NOT EXISTS "PropertyRatePlan" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rentAmount" DOUBLE PRECISION NOT NULL,
  "rentPeriod" TEXT NOT NULL DEFAULT 'MONTH',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "rules" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "minStayNights" INTEGER,
  "maxStayNights" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyRatePlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyRatePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyRatePlan_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PropertyRatePlan_propertyId_idx" ON "PropertyRatePlan"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyRatePlan_unitId_idx" ON "PropertyRatePlan"("unitId");
CREATE INDEX IF NOT EXISTS "PropertyRatePlan_isActive_idx" ON "PropertyRatePlan"("isActive");

-- 5. PropertyAvailability
CREATE TABLE IF NOT EXISTS "PropertyAvailability" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "rate" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "minStay" INTEGER,
  "maxStay" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyAvailability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyAvailability_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyAvailability_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyAvailability_propertyId_unitId_date_key" ON "PropertyAvailability"("propertyId", "unitId", "date");
CREATE INDEX IF NOT EXISTS "PropertyAvailability_propertyId_date_idx" ON "PropertyAvailability"("propertyId", "date");
CREATE INDEX IF NOT EXISTS "PropertyAvailability_status_idx" ON "PropertyAvailability"("status");

-- 6. PropertyReview
CREATE TABLE IF NOT EXISTS "PropertyReview" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "reviewerId" TEXT,
  "reviewerName" TEXT,
  "reviewerEmail" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "comment" TEXT,
  "stayStartDate" TIMESTAMP(3),
  "stayEndDate" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'DIRECT',
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "response" TEXT,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyReview_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyReview_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PropertyReview_propertyId_idx" ON "PropertyReview"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyReview_unitId_idx" ON "PropertyReview"("unitId");
CREATE INDEX IF NOT EXISTS "PropertyReview_rating_idx" ON "PropertyReview"("rating");
CREATE INDEX IF NOT EXISTS "PropertyReview_createdAt_idx" ON "PropertyReview"("createdAt");

-- 7. PropertyFavorite
CREATE TABLE IF NOT EXISTS "PropertyFavorite" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyFavorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyFavorite_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyFavorite_userId_propertyId_unitId_key" ON "PropertyFavorite"("userId", "propertyId", "unitId");
CREATE INDEX IF NOT EXISTS "PropertyFavorite_userId_idx" ON "PropertyFavorite"("userId");
CREATE INDEX IF NOT EXISTS "PropertyFavorite_propertyId_idx" ON "PropertyFavorite"("propertyId");

-- 8. PropertyMessage
CREATE TABLE IF NOT EXISTS "PropertyMessage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderEmail" TEXT,
  "senderName" TEXT,
  "recipientId" TEXT,
  "recipientEmail" TEXT,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'text/plain',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PropertyMessage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PropertyManagerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropertyMessage_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PropertyMessage_conversationId_idx" ON "PropertyMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "PropertyMessage_propertyId_idx" ON "PropertyMessage"("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyMessage_senderEmail_idx" ON "PropertyMessage"("senderEmail");
CREATE INDEX IF NOT EXISTS "PropertyMessage_recipientEmail_idx" ON "PropertyMessage"("recipientEmail");
CREATE INDEX IF NOT EXISTS "PropertyMessage_isRead_idx" ON "PropertyMessage"("isRead");
CREATE INDEX IF NOT EXISTS "PropertyMessage_createdAt_idx" ON "PropertyMessage"("createdAt");

-- 9. Vendor
CREATE TABLE IF NOT EXISTS "Vendor" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "managerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rating" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vendor_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "PropertyManagerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Vendor_managerId_idx" ON "Vendor"("managerId");

-- 10. Task
CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "managerId" TEXT NOT NULL,
  "contactId" TEXT,
  "relatedType" TEXT,
  "relatedId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "assigneeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Task_managerId_idx" ON "Task"("managerId");
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");

-- 11. Communication
CREATE TABLE IF NOT EXISTS "Communication" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "managerId" TEXT NOT NULL,
  "contactId" TEXT,
  "type" TEXT NOT NULL,
  "direction" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "duration" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Communication_managerId_idx" ON "Communication"("managerId");
CREATE INDEX IF NOT EXISTS "Communication_contactId_idx" ON "Communication"("contactId");
CREATE INDEX IF NOT EXISTS "Communication_type_idx" ON "Communication"("type");
CREATE INDEX IF NOT EXISTS "Communication_createdAt_idx" ON "Communication"("createdAt");

-- 12. Add columns to existing tables
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "vendorName" TEXT;
ALTER TABLE "PropertyMaintenance" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "PropertyMaintenance" ADD CONSTRAINT "PropertyMaintenance_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyMaintenance" ADD CONSTRAINT "PropertyMaintenance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantDocument" ADD COLUMN IF NOT EXISTS "maintenanceId" TEXT;
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "PropertyMaintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
