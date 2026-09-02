-- Migration: add_current_hash_to_trust_audit
-- Created: 2026-09-02
-- Purpose: Add currentHash column to TrustAuditTrail table

ALTER TABLE "TrustAuditTrail" ADD COLUMN IF NOT EXISTS "currentHash" TEXT;

-- Add unique constraint if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = "TrustAuditTrail_currentHash_key") THEN
    ALTER TABLE "TrustAuditTrail" ADD CONSTRAINT "TrustAuditTrail_currentHash_key" UNIQUE ("currentHash");
  END IF;
END $$;
