-- ═══════════════════════════════════════════════════════════════════════════
-- Scoped Trust Scores + Invoice Events
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Alter TrustPassport — add scoped scores, sample sizes, character flags
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "showUpScore" INTEGER DEFAULT 500;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "paymentScore" INTEGER DEFAULT 500;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "deliveryScore" INTEGER DEFAULT 500;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "tenancyScore" INTEGER DEFAULT 500;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "freightScore" INTEGER DEFAULT 500;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "showUpSampleSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "paymentSampleSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "deliverySampleSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "tenancySampleSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "freightSampleSize" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "verifiedIdentity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "fraudFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "fraudFlaggedAt" TIMESTAMP(3);
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "escrowTheftFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustPassport" ADD COLUMN IF NOT EXISTS "chargebackFraudCount" INTEGER NOT NULL DEFAULT 0;

-- 2. Create Invoice table
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "dateIssued" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateDue" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX IF NOT EXISTS "Invoice_businessId_status_idx" ON "Invoice"("businessId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_clientId_idx" ON "Invoice"("clientId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "CrmClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Create InvoiceTrustEvent table
CREATE TABLE IF NOT EXISTS "InvoiceTrustEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "scoreBefore" INTEGER,
    "scoreAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceTrustEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InvoiceTrustEvent_invoiceId_idx" ON "InvoiceTrustEvent"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceTrustEvent_passportId_idx" ON "InvoiceTrustEvent"("passportId");
CREATE INDEX IF NOT EXISTS "InvoiceTrustEvent_createdAt_idx" ON "InvoiceTrustEvent"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceTrustEvent_invoiceId_eventType_key"
    ON "InvoiceTrustEvent"("invoiceId", "eventType");

ALTER TABLE "InvoiceTrustEvent" ADD CONSTRAINT "InvoiceTrustEvent_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceTrustEvent" ADD CONSTRAINT "InvoiceTrustEvent_passportId_fkey"
    FOREIGN KEY ("passportId") REFERENCES "TrustPassport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
