-- Sulha staked arbitrator panel: the TrustPassport gate for human review.
--
-- `isArbitrator` opts a passport into the panel that hears escrow disputes
-- Jev left at human_review. `arbitratorSince` records when the stake was
-- taken, so panel tenure is auditable in the same row. See the model comments
-- in schema.prisma and the Sulha notes in 20261023_sulha_escrow_dispute.

ALTER TABLE "TrustPassport" ADD COLUMN "isArbitrator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrustPassport" ADD COLUMN "arbitratorSince" TIMESTAMP(3);
