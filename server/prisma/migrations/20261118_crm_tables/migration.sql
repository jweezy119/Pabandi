-- Contact OS CRM tables.
-- Hand-written and idempotent: this database is migrated by a pre-deploy step,
-- and the tables may already exist on a database that was migrated by hand.

CREATE TABLE IF NOT EXISTS "crm_deals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stage" TEXT NOT NULL DEFAULT 'LEAD',
    "probability" INTEGER NOT NULL DEFAULT 10,
    "expectedCloseDate" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "lostReason" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "ownerName" TEXT,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_deals_serviceBusinessId_idx" ON "crm_deals"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_deals_businessId_idx" ON "crm_deals"("businessId");
CREATE INDEX IF NOT EXISTS "crm_deals_stage_idx" ON "crm_deals"("stage");

CREATE TABLE IF NOT EXISTS "crm_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMPTZ,
    "clientId" TEXT,
    "dealId" TEXT,
    "assignedTo" TEXT,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_tasks_serviceBusinessId_idx" ON "crm_tasks"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_tasks_businessId_idx" ON "crm_tasks"("businessId");
CREATE INDEX IF NOT EXISTS "crm_tasks_status_idx" ON "crm_tasks"("status");

CREATE TABLE IF NOT EXISTS "crm_activities" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "description" TEXT,
    "clientId" TEXT,
    "dealId" TEXT,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_activities_serviceBusinessId_idx" ON "crm_activities"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_activities_businessId_idx" ON "crm_activities"("businessId");
CREATE INDEX IF NOT EXISTS "crm_activities_type_idx" ON "crm_activities"("type");

CREATE TABLE IF NOT EXISTS "crm_files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clientId" TEXT,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crm_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_files_serviceBusinessId_idx" ON "crm_files"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_files_businessId_idx" ON "crm_files"("businessId");

CREATE TABLE IF NOT EXISTS "crm_employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "payRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payType" TEXT NOT NULL DEFAULT 'HOURLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "jobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastBookingAt" TIMESTAMPTZ,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_employees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_employees_serviceBusinessId_idx" ON "crm_employees"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_employees_businessId_idx" ON "crm_employees"("businessId");

CREATE TABLE IF NOT EXISTS "crm_payrolls" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ NOT NULL,
    "periodEnd" TIMESTAMPTZ NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_payrolls_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_payrolls_serviceBusinessId_idx" ON "crm_payrolls"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_payrolls_businessId_idx" ON "crm_payrolls"("businessId");
CREATE INDEX IF NOT EXISTS "crm_payrolls_employeeId_idx" ON "crm_payrolls"("employeeId");

CREATE TABLE IF NOT EXISTS "crm_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMPTZ,
    "businessId" TEXT,
    "serviceBusinessId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crm_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_alerts_serviceBusinessId_idx" ON "crm_alerts"("serviceBusinessId");
CREATE INDEX IF NOT EXISTS "crm_alerts_businessId_idx" ON "crm_alerts"("businessId");

CREATE TABLE IF NOT EXISTS "crm_availability" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "serviceBusinessId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "crm_availability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_availability_serviceBusinessId_weekday_key" ON "crm_availability"("serviceBusinessId", "weekday");
