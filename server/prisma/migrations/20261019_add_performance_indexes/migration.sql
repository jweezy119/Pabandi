-- Performance indexes.
--
-- Generated with `prisma migrate diff` against a scratch database, so the index
-- names below are exactly the ones Prisma would have produced in
-- `migrate dev`. Do not rename them: Prisma tracks indexes by name when it
-- checks for drift, and a rename here reads as drop + create.
--
-- Invoice(businessId, status) is intentionally absent. It already existed on
-- schema.prisma before this migration, so there is nothing to create.

-- CreateIndex
CREATE INDEX "crm_clients_businessId_email_idx" ON "crm_clients"("businessId", "email");

-- CreateIndex
CREATE INDEX "TrustPassport_paymentScore_idx" ON "TrustPassport"("paymentScore");

-- CreateIndex
CREATE INDEX "OnchainAttestation_passportId_eventType_idx" ON "OnchainAttestation"("passportId", "eventType");