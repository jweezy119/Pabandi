-- Add businessType to PropertyManagerProfile
ALTER TABLE "PropertyManagerProfile" ADD COLUMN IF NOT EXISTS "businessType" TEXT NOT NULL DEFAULT 'GENERAL';
