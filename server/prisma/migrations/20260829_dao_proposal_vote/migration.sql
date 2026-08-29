-- CreateTable
CREATE TABLE "DaoProposal" (
    "id" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "forVotes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "againstVotes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quorum" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DaoProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DaoVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DaoVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DaoProposal_status_idx" ON "DaoProposal"("status");

-- CreateIndex
CREATE INDEX "DaoProposal_proposerId_idx" ON "DaoProposal"("proposerId");

-- CreateIndex
CREATE INDEX "DaoVote_proposalId_idx" ON "DaoVote"("proposalId");

-- CreateIndex
CREATE INDEX "DaoVote_voterId_idx" ON "DaoVote"("voterId");

-- AddForeignKey
ALTER TABLE "DaoVote" ADD CONSTRAINT "DaoVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "DaoProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
