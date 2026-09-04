-- Add trust-stake column to ProjectBid (additive; PAB bonded on bid, slashed/rewarded)
ALTER TABLE "ProjectBid" ADD COLUMN "stakePab" DOUBLE PRECISION NOT NULL DEFAULT 0;
