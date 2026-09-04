-- CreateTable
CREATE TABLE "GigEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'human',
    "skill" TEXT,
    "budgetUsd" DOUBLE PRECISION,
    "category" TEXT,
    "claimedBy" TEXT,
    "rakeSol" DOUBLE PRECISION,
    "helperSol" DOUBLE PRECISION,
    "referralCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GigEvent_gigId_idx" ON "GigEvent"("gigId");
CREATE INDEX "GigEvent_kind_idx" ON "GigEvent"("kind");
CREATE INDEX "GigEvent_source_idx" ON "GigEvent"("source");
