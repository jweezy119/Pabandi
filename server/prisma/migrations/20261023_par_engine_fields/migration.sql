-- PAR Engine: extend OnchainAttestation with settlement receipt and agent identity fields.
--
-- Adds four nullable columns to OnchainAttestation so that data escrow settlements
-- can be anchored to a signed receipt from the payment rail (Solana tx signature,
-- Stripe receipt ID, etc.). This makes PAR records "costly to fake" because every
-- reputation claim is tied to a verifiable payment receipt.

ALTER TABLE "OnchainAttestation" ADD COLUMN "settlementReceiptSignature" TEXT;
ALTER TABLE "OnchainAttestation" ADD COLUMN "buyerAgentId" TEXT;
ALTER TABLE "OnchainAttestation" ADD COLUMN "sellerAgentId" TEXT;
ALTER TABLE "OnchainAttestation" ADD COLUMN "dataHash" TEXT;

CREATE INDEX "OnchainAttestation_settlementReceiptSignature_idx"
  ON "OnchainAttestation"("settlementReceiptSignature");
