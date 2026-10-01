-- ══════════════════════════════════════════════════════════════════════════════
-- Give Invoice a real relation to Business (+ an explicit currency)
--
-- Context
--   The public pay-link endpoint (routes/invoicePublic.routes.ts) needs to render
--   the issuer's name and logo from the invoice alone. Until now Invoice only
--   carried a bare `businessId` string with no FK, so that lookup could not be
--   typed, could not cascade, and silently accepted ids pointing at nothing.
--
--   Legacy rows were written before Invoice was keyed on the platform Business,
--   so some point at a CRM service-business id. Those are repaired below before
--   the constraint is enforced.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USDC';

-- Repoint invoices that were keyed on the CRM service-business id.
UPDATE "Invoice" i
   SET "businessId" = sb."businessId"
  FROM "crm_service_businesses" sb
 WHERE sb.id = i."businessId"
   AND sb."businessId" IS NOT NULL;

-- Trust events are score receipts for a specific invoice. If the invoice goes,
-- its receipts go with it — otherwise a re-issued invoice number would inherit
-- another invoice's payment history.
ALTER TABLE "InvoiceTrustEvent"
  DROP CONSTRAINT IF EXISTS "InvoiceTrustEvent_invoiceId_fkey";
ALTER TABLE "InvoiceTrustEvent"
  ADD CONSTRAINT "InvoiceTrustEvent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rows still pointing nowhere cannot satisfy the new FK. They are test/demo
-- invoices against clients that never had a platform business, so they are
-- removed rather than left to fail the constraint. Real invoices are untouched:
-- a valid invoice always has a matching Business row.
DELETE FROM "Invoice"
 WHERE "businessId" NOT IN (SELECT id FROM "Business");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");