-- CreateTable
CREATE TABLE "UsdyLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "propertyType" TEXT,
    "portfolioSize" INTEGER,
    "country" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'usdy_landing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsdyLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsdyLead_email_key" ON "UsdyLead"("email");
CREATE INDEX "UsdyLead_createdAt_idx" ON "UsdyLead"("createdAt");
CREATE INDEX "UsdyLead_country_idx" ON "UsdyLead"("country");
