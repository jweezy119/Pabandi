-- Relax NOT NULL on columns schema.prisma declares optional.
--
-- ─── WHY THIS IS A BUG FIX AND NOT COSMETIC DRIFT ──────────────────────────────
--
-- 17 columns are NOT NULL in production but optional (`String?`) in
-- schema.prisma. Every Prisma insert that omits one of them fails:
--
--   Null constraint violation on the fields: (`phone`)
--
-- This is not hypothetical. It is the same defect described in
-- 20260930_unified_business_os, which renamed the CRM tables and noted that
-- "every enrollment insert fails with Null constraint violation on the fields:
-- (`businessName`) ... which is precisely the request that creates a business.
-- The rename was tested against reads, which is why it surfaced only on writes."
--
-- The same class survived into crm_clients, crm_jobs, crm_employees, CrmDeal,
-- CrmActivity, CrmFile and crm_alerts: the unified business-OS work made
-- `serviceBusinessId` the tenant anchor and `businessId` optional, but the
-- tables kept their pre-rename NOT NULL constraints. Verified against
-- production before writing this:
--
--   crmClient.create({ name, email, serviceBusinessId })
--     -> Invalid `prisma.crmClient.create()` invocation:
--        Null constraint violation on the fields: (`phone`)
--
-- ─── WHY DROP NOT NULL AND NOT SUPPLY DEFAULTS ─────────────────────────────────
--
-- The alternative is to make the schema required, which would mean inventing a
-- value for a column the application does not collect: an empty string for
-- `phone` would create a customer with a blank phone number that looks real,
-- and a fabricated `scheduledTime` would corrupt the availability maths that
-- reads it. Dropping the constraint is the honest direction — the column is
-- genuinely optional, and the database was enforcing a requirement the code
-- never had.
--
-- Relaxing a constraint loses no data and cannot fail on existing rows: the
-- tables it touches were all confirmed to hold zero rows anyway.
--
-- Verified safe: this only ever turns a rejected write into an accepted one.

ALTER TABLE "crm_clients"    ALTER COLUMN "email"              DROP NOT NULL;
ALTER TABLE "crm_clients"    ALTER COLUMN "phone"              DROP NOT NULL;
ALTER TABLE "crm_clients"    ALTER COLUMN "address"            DROP NOT NULL;
ALTER TABLE "crm_clients"    ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;

ALTER TABLE "crm_employees"  ALTER COLUMN "email"              DROP NOT NULL;
ALTER TABLE "crm_employees"  ALTER COLUMN "phone"              DROP NOT NULL;
ALTER TABLE "crm_employees"  ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;

ALTER TABLE "crm_jobs"       ALTER COLUMN "scheduledTime"      DROP NOT NULL;
ALTER TABLE "crm_jobs"       ALTER COLUMN "address"            DROP NOT NULL;
ALTER TABLE "crm_jobs"       ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;

ALTER TABLE "crm_payrolls"   ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;
ALTER TABLE "crm_expenses"   ALTER COLUMN "description"        DROP NOT NULL;
ALTER TABLE "crm_expenses"   ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;
ALTER TABLE "crm_alerts"     ALTER COLUMN "serviceBusinessId"  DROP NOT NULL;

ALTER TABLE "CrmDeal"        ALTER COLUMN "businessId"         DROP NOT NULL;
ALTER TABLE "CrmActivity"    ALTER COLUMN "businessId"         DROP NOT NULL;
ALTER TABLE "CrmFile"        ALTER COLUMN "businessId"         DROP NOT NULL;
