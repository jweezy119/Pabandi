-- ══════════════════════════════════════════════════════════════════════════════
-- Drop legacy CRM columns left behind by the table rename
--
-- Context
--   20260930_unified_business_os renamed "CrmBusiness" to "crm_service_businesses"
--   to adopt the canonical `@@map` name. Renaming a table in Postgres keeps all
--   of its columns, so the pre-rename columns — businessName, ownerEmail,
--   ownerName, isActive, phone, address — came across with it.
--
--   Three of those are NOT NULL with no default and are absent from the unified
--   model, so *every* enrollment insert fails with
--     Null constraint violation on the fields: (`businessName`)
--   which is precisely the request that creates a business. The rename was
--   tested against reads, which is why this surfaced only on the write path.
--
--   The columns are dead: the unified model derives everything from the linked
--   `Business` row (name, email, phone, address) and `ownerId`, which is what
--   makes the CRM a view over a platform business rather than a parallel silo.
-- ══════════════════════════════════════════════════════════════════════════════

-- Legacy identity columns, superseded by the Business relation.
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "businessName";
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "ownerEmail";
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "ownerName";

-- Lifecycle flag superseded by Business.isActive.
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "isActive";

-- Contact details superseded by Business.phone / Business.address.
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "crm_service_businesses" DROP COLUMN IF EXISTS "address";

-- `crm_clients.isActive` is likewise superseded by `status` / `stage`, which the
-- trust-aware pipeline actually uses. It has a default, so it never blocked an
-- insert, but leaving two competing lifecycle columns invites code that reads
-- the one nothing writes.
ALTER TABLE "crm_clients" DROP COLUMN IF EXISTS "isActive";

-- `crm_jobs.duration` was superseded by `durationMinutes`.
ALTER TABLE "crm_jobs" DROP COLUMN IF EXISTS "duration";

-- Indexes that referenced the dropped columns.
DROP INDEX IF EXISTS "CrmClient_isActive_idx";
DROP INDEX IF EXISTS "CrmClient_name_idx";
