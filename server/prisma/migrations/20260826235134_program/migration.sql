CREATE TABLE "Program" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "clientWallet" TEXT,
  "referralCode" TEXT,
  "durationWeeks" INTEGER NOT NULL DEFAULT 52,
  "totalBudgetUsd" DOUBLE PRECISION NOT NULL,
  "taskCount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProgramTask" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "skill" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "budgetUsd" DOUBLE PRECISION NOT NULL,
  "estimatedHours" INTEGER NOT NULL,
  "gigId" TEXT,
  "assignedAgentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgramTask_programId_idx" ON "ProgramTask"("programId");
CREATE INDEX "ProgramTask_status_idx" ON "ProgramTask"("status");
ALTER TABLE "ProgramTask" ADD CONSTRAINT "ProgramTask_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
