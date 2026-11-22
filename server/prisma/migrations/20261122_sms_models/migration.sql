-- Restore the SMS feature's tables, removed by 4e5b9e39 ("technical cleanup,
-- monolith split, schema purge").
--
-- The client still calls /api/v1/sms/{send,bulk,logs,status}, and the routes were
-- restored in the same change, so without these tables every one of them 500s.
--
-- All four are owned by Business with ON DELETE CASCADE, so deleting a business
-- takes its SMS history with it and no orphan-cleanup path is needed.
--
-- `MerchantSubscription.businessId` is UNIQUE and that is load-bearing rather
-- than incidental: Business.merchantSubscription is a one-to-one, which is what
-- lets the fee engine read a merchant's tier without a query for duplicates.
-- Two active rows would mean two tiers and an ambiguous answer.

CREATE TABLE IF NOT EXISTS "SMSLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "cost" DOUBLE PRECISION,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SMSLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChannelMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BusinessSmsProvider" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessSmsProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MerchantSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "whopMembershipId" TEXT,
    "whopPlanId" TEXT,
    "whopCompanyId" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "lastWebhookId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MerchantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_key" ON "BusinessSmsProvider"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "MerchantSubscription_businessId_key" ON "MerchantSubscription"("businessId");

CREATE INDEX IF NOT EXISTS "SMSLog_businessId_idx" ON "SMSLog"("businessId");
CREATE INDEX IF NOT EXISTS "SMSLog_status_idx" ON "SMSLog"("status");
CREATE INDEX IF NOT EXISTS "SMSLog_provider_idx" ON "SMSLog"("provider");

CREATE INDEX IF NOT EXISTS "ChannelMessage_businessId_idx" ON "ChannelMessage"("businessId");
CREATE INDEX IF NOT EXISTS "ChannelMessage_customerId_idx" ON "ChannelMessage"("customerId");
CREATE INDEX IF NOT EXISTS "ChannelMessage_channel_idx" ON "ChannelMessage"("channel");
CREATE INDEX IF NOT EXISTS "ChannelMessage_status_idx" ON "ChannelMessage"("status");
CREATE INDEX IF NOT EXISTS "ChannelMessage_createdAt_idx" ON "ChannelMessage"("createdAt");

CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_businessId_idx" ON "BusinessSmsProvider"("businessId");
CREATE INDEX IF NOT EXISTS "BusinessSmsProvider_status_idx" ON "BusinessSmsProvider"("status");

CREATE INDEX IF NOT EXISTS "MerchantSubscription_businessId_status_idx" ON "MerchantSubscription"("businessId", "status");
CREATE INDEX IF NOT EXISTS "MerchantSubscription_whopMembershipId_idx" ON "MerchantSubscription"("whopMembershipId");
CREATE INDEX IF NOT EXISTS "MerchantSubscription_status_idx" ON "MerchantSubscription"("status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SMSLog_businessId_fkey') THEN
        ALTER TABLE "SMSLog" ADD CONSTRAINT "SMSLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChannelMessage_businessId_fkey') THEN
        ALTER TABLE "ChannelMessage" ADD CONSTRAINT "ChannelMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessSmsProvider_businessId_fkey') THEN
        ALTER TABLE "BusinessSmsProvider" ADD CONSTRAINT "BusinessSmsProvider_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MerchantSubscription_businessId_fkey') THEN
        ALTER TABLE "MerchantSubscription" ADD CONSTRAINT "MerchantSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
