-- AlterTable
ALTER TABLE "CourtCheck" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'COURTLISTENER';

-- CreateIndex
CREATE INDEX "CourtCheck_source_idx" ON "CourtCheck"("source");
