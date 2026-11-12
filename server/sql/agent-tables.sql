-- Agent onboarding tables.
-- "AgentMarketplace" backs agent signup, API-key auth, passport issuance and
-- the discovery manifests, but it was never in a Prisma migration. Without it
-- every agent call fails with `relation "AgentMarketplace" does not exist`
-- while the routes themselves look healthy.
-- Idempotent: safe to run on every boot and every deploy.
CREATE TABLE IF NOT EXISTS "AgentMarketplace" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  "ownerEmail" TEXT,
  "displayName" TEXT,
  description TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "completedTasks" INTEGER NOT NULL DEFAULT 0,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  "apiKeyHash" TEXT,
  "walletAddress" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMarketplace_apiKeyHash_key" ON "AgentMarketplace" ("apiKeyHash") WHERE "apiKeyHash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "AgentMarketplace_ownerEmail_idx" ON "AgentMarketplace" ("ownerEmail");
CREATE INDEX IF NOT EXISTS "AgentMarketplace_status_idx" ON "AgentMarketplace" ("status");

-- Ensure User.preferredMode column exists for Business <-> Personal mode switching
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredMode" TEXT NOT NULL DEFAULT 'business';

-- Project Simulator tables ("ProjectSimulation" and "SimulationAgentRun")
CREATE TABLE IF NOT EXISTS "ProjectSimulation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "projectType" TEXT NOT NULL,
  "initialFactors" JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  "finalEstimate" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ProjectSimulation_userId_idx" ON "ProjectSimulation" ("userId");
CREATE INDEX IF NOT EXISTS "ProjectSimulation_status_idx" ON "ProjectSimulation" (status);

CREATE TABLE IF NOT EXISTS "SimulationAgentRun" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "simulationId" TEXT NOT NULL REFERENCES "ProjectSimulation"(id) ON DELETE CASCADE,
  "agentRole" TEXT NOT NULL,
  "inputPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "outputPayload" JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  "executionTimeMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_simulationId_idx" ON "SimulationAgentRun" ("simulationId");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_agentRole_idx" ON "SimulationAgentRun" ("agentRole");
CREATE INDEX IF NOT EXISTS "SimulationAgentRun_status_idx" ON "SimulationAgentRun" (status);

-- Ensure all Business columns exist
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "externalBookingUrl" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "externalBookingPlatform" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "karmaScore" DOUBLE PRECISION DEFAULT 50.0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "businessTier" TEXT DEFAULT 'STANDARD';
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "trustScore" DOUBLE PRECISION DEFAULT 50.0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "saasCreditBalance" DOUBLE PRECISION DEFAULT 0.0;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "raastId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMPTZ;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "deviceFingerprint" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "externalDetails" JSONB;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "menuJson" JSONB;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "menuSyncedAt" TIMESTAMPTZ;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "checkInTime" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "checkOutTime" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "channexPropertyId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "serviceAddress" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "serviceLat" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "serviceLng" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "serviceRadiusMiles" DOUBLE PRECISION DEFAULT 25;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "travelFeeEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "travelFeePerMile" DOUBLE PRECISION DEFAULT 0.50;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "maxTravelMinutes" INTEGER DEFAULT 45;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "maxConcurrentBookings" INTEGER DEFAULT 1;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "valuesPreferences" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bountyPaid" BOOLEAN DEFAULT false;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "acceptsAgentBookings" BOOLEAN DEFAULT false;

-- Ensure BusinessService table exists
CREATE TABLE IF NOT EXISTS "BusinessService" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DOUBLE PRECISION NOT NULL,
  duration INTEGER NOT NULL,
  "isActive" BOOLEAN DEFAULT TRUE,
  category TEXT,
  "imageUrl" TEXT,
  tags JSONB,
  metadata JSONB,
  "discountPrice" DOUBLE PRECISION,
  "bookingLeadTime" INTEGER,
  "maxBookingsPerDay" INTEGER,
  "locationType" TEXT,
  requirements TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "requiredResourceKind" TEXT,
  "requiresProvider" BOOLEAN DEFAULT FALSE,
  "genderPolicy" TEXT DEFAULT 'UNSPECIFIED',
  "retainerBps" INTEGER DEFAULT 0,
  "cancellationNoticeHours" INTEGER DEFAULT 24,
  "cancellationCostAmount" DOUBLE PRECISION DEFAULT 0,
  "noShowForfeitsRetainer" BOOLEAN DEFAULT TRUE,
  "minNoticeHours" INTEGER DEFAULT 0,
  "turnaroundMinutes" INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "BusinessService_businessId_idx" ON "BusinessService" ("businessId");

-- Ensure TrustPassport table exists
CREATE TABLE IF NOT EXISTS "TrustPassport" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  handle TEXT UNIQUE NOT NULL,
  "agentId" TEXT,
  "onchainAgentId" TEXT,
  "onchainIdentityRegistered" BOOLEAN DEFAULT FALSE,
  "providerRef" TEXT,
  category TEXT DEFAULT 'FREELANCER',
  "displayName" TEXT NOT NULL,
  bio TEXT,
  "walletAddress" TEXT UNIQUE,
  visibility TEXT DEFAULT 'PUBLIC',
  "privacySettings" JSONB,
  "socialLinks" JSONB,
  "portfolioItems" JSONB,
  skills JSONB,
  headline TEXT,
  location TEXT,
  "websiteUrl" TEXT,
  "avatarUrl" TEXT,
  "coverImageUrl" TEXT,
  "displayTheme" TEXT DEFAULT 'clay',
  "showOnPublicProfile" BOOLEAN DEFAULT TRUE,
  "claimsCount" INTEGER DEFAULT 0,
  "riskScore" INTEGER,
  "riskBand" TEXT,
  "lastCheckedAt" TIMESTAMPTZ,
  "userId" TEXT UNIQUE,
  score DOUBLE PRECISION,
  level TEXT,
  verified BOOLEAN,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "showUpScore" INTEGER DEFAULT 500,
  "paymentScore" INTEGER DEFAULT 500,
  "deliveryScore" INTEGER DEFAULT 500,
  "tenancyScore" INTEGER DEFAULT 500,
  "freightScore" INTEGER DEFAULT 500,
  "showUpSampleSize" INTEGER DEFAULT 0,
  "paymentSampleSize" INTEGER DEFAULT 0,
  "deliverySampleSize" INTEGER DEFAULT 0,
  "tenancySampleSize" INTEGER DEFAULT 0,
  "freightSampleSize" INTEGER DEFAULT 0,
  "verifiedIdentity" BOOLEAN DEFAULT FALSE,
  "verifiedAt" TIMESTAMPTZ,
  "fraudFlag" BOOLEAN DEFAULT FALSE,
  "fraudFlaggedAt" TIMESTAMPTZ,
  "escrowTheftFlag" BOOLEAN DEFAULT FALSE,
  "chargebackFraudCount" INTEGER DEFAULT 0,
  "verifiedLocationCount" INTEGER DEFAULT 0,
  "isArbitrator" BOOLEAN DEFAULT FALSE,
  "arbitratorSince" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrustPassport_handle_key" ON "TrustPassport" (handle);
CREATE INDEX IF NOT EXISTS "TrustPassport_category_idx" ON "TrustPassport" (category);
CREATE INDEX IF NOT EXISTS "TrustPassport_userId_idx" ON "TrustPassport" ("userId");

-- Ensure BusinessAvailability table exists
CREATE TABLE IF NOT EXISTS "BusinessAvailability" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "slotMinutes" INTEGER NOT NULL DEFAULT 60,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "BusinessAvailability_businessId_dayOfWeek_idx" ON "BusinessAvailability" ("businessId", "dayOfWeek");

-- Ensure BlackoutDate table exists
CREATE TABLE IF NOT EXISTS "BlackoutDate" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "BlackoutDate_businessId_date_idx" ON "BlackoutDate" ("businessId", date);

-- Ensure SlotLock table exists
CREATE TABLE IF NOT EXISTS "SlotLock" (
  "lockKey" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "slotStart" TIMESTAMPTZ NOT NULL,
  "slotEnd" TIMESTAMPTZ NOT NULL,
  "sessionId" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SlotLock_businessId_slotStart_idx" ON "SlotLock" ("businessId", "slotStart");

-- Ensure Booking table exists
CREATE TABLE IF NOT EXISTS "Booking" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL REFERENCES "Business"(id) ON DELETE CASCADE,
  "clientId" TEXT,
  "slotStart" TIMESTAMPTZ NOT NULL,
  "slotEnd" TIMESTAMPTZ NOT NULL,
  "serviceType" TEXT NOT NULL,
  "depositAmount" DOUBLE PRECISION,
  "depositStatus" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "paymentRef" TEXT,
  "paidVia" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "clientAddress" TEXT,
  "clientLat" DOUBLE PRECISION,
  "clientLng" DOUBLE PRECISION,
  "distanceMiles" DOUBLE PRECISION,
  "driveMinutes" INTEGER,
  "travelFee" DOUBLE PRECISION DEFAULT 0,
  "depositReason" TEXT,
  "depositPaid" BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS "Booking_businessId_slotStart_idx" ON "Booking" ("businessId", "slotStart");

-- Ensure McpPrepaidBalance and McpMeter tables exist for x402 MCP metering
CREATE TABLE IF NOT EXISTS "McpPrepaidBalance" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "apiKeyHash" TEXT NOT NULL UNIQUE,
  "balanceUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpPrepaidBalance_apiKeyHash_key" ON "McpPrepaidBalance" ("apiKeyHash");
CREATE INDEX IF NOT EXISTS "McpPrepaidBalance_apiKeyHash_idx" ON "McpPrepaidBalance" ("apiKeyHash");

CREATE TABLE IF NOT EXISTS "McpMeter" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "apiKeyHash" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "windowStart" TIMESTAMPTZ NOT NULL,
  "callsCount" INTEGER NOT NULL DEFAULT 0,
  "chargedUsdc" DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpMeter_apiKeyHash_toolName_windowStart_key" ON "McpMeter" ("apiKeyHash", "toolName", "windowStart");
CREATE INDEX IF NOT EXISTS "McpMeter_apiKeyHash_toolName_windowStart_idx" ON "McpMeter" ("apiKeyHash", "toolName", "windowStart");

-- Ensure ProfileType enum and User/Business columns exist
DO $$ BEGIN
  CREATE TYPE "ProfileType" AS ENUM ('SOLO_BUILDER', 'CLIENT', 'SERVICE_BUSINESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileType" "ProfileType";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User" ("telegramId") WHERE "telegramId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_telegramId_idx" ON "User" ("telegramId");

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "profileType" "ProfileType";

-- Ensure DisputeEvidence table exists for MCP file uploads
CREATE TABLE IF NOT EXISTS "DisputeEvidence" (
  id TEXT PRIMARY KEY,
  "workOrderId" TEXT NOT NULL REFERENCES "WorkOrder"(id) ON DELETE CASCADE,
  "fileId" TEXT NOT NULL UNIQUE,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "vcapHash" TEXT NOT NULL,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "DisputeEvidence_workOrderId_idx" ON "DisputeEvidence" ("workOrderId");

