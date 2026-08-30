-- CreateTable
CREATE TABLE "CourtCheck" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'TENANT',
    "name" TEXT NOT NULL,
    "state" TEXT,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "count" INTEGER NOT NULL DEFAULT 0,
    "recentEviction" BOOLEAN NOT NULL DEFAULT false,
    "riskBand" TEXT NOT NULL DEFAULT 'LOW',
    "cases" JSONB,
    "reservationId" TEXT,
    "businessId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtCheck_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CourtCheck" ADD CONSTRAINT "CourtCheck_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtCheck" ADD CONSTRAINT "CourtCheck_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtCheck" ADD CONSTRAINT "CourtCheck_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CourtCheck_reservationId_idx" ON "CourtCheck"("reservationId");

-- CreateIndex
CREATE INDEX "CourtCheck_businessId_idx" ON "CourtCheck"("businessId");

-- CreateIndex
CREATE INDEX "CourtCheck_customerId_idx" ON "CourtCheck"("customerId");

-- CreateIndex
CREATE INDEX "CourtCheck_riskBand_idx" ON "CourtCheck"("riskBand");
