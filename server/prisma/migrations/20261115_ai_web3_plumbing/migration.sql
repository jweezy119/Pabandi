-- AI/Web3 plumbing: receipt image off-database, booking risk, escrow receipt fields.

CREATE TABLE "BookingRisk" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "band" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calibrated" BOOLEAN NOT NULL DEFAULT false,
    "outcome" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRisk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingRisk_bookingId_key" ON "BookingRisk"("bookingId");
CREATE INDEX "BookingRisk_outcome_idx" ON "BookingRisk"("outcome");

ALTER TABLE "BookingRisk" ADD CONSTRAINT "BookingRisk_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniversalEscrow"
    ADD COLUMN "rail" TEXT,
    ADD COLUMN "txHash" TEXT,
    ADD COLUMN "receiptRef" TEXT,
    ADD COLUMN "settledAt" TIMESTAMP(3),
    ADD COLUMN "simulated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PaymentReceipt"
    ADD COLUMN "imageHash" TEXT,
    ADD COLUMN "imageStorageKey" TEXT,
    ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "PaymentReceipt" DROP COLUMN "imageBase64";

CREATE UNIQUE INDEX "PaymentReceipt_imageHash_key" ON "PaymentReceipt"("imageHash");

ALTER TABLE "OfframpProof"
    ADD COLUMN "imageHash" TEXT,
    ADD COLUMN "imageStorageKey" TEXT,
    ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "OfframpProof" DROP COLUMN "imageBase64";

CREATE UNIQUE INDEX "OfframpProof_imageHash_key" ON "OfframpProof"("imageHash");
