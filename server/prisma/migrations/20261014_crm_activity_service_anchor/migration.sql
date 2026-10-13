-- CrmActivity.serviceBusinessId backfill
--
-- No create path in the codebase ever wrote this column. The activity and task
-- routes both took the tenant from the token's platform `Business.id` and wrote
-- it into the legacy `businessId` column, which is documented as the CrmBusiness
-- anchor and which reports.service.ts deliberately refuses to OR in.
--
-- The consequence was that every activity metric in the product read from
-- `serviceBusinessId` and matched nothing: the dashboard reported zero
-- activities and zero tasks for every tenant, while the Activities and Tasks
-- pages listed them correctly. Writes and reads disagreed about which column
-- identified a tenant, and only one of the two was ever populated.
--
-- This backfills the rows written before the routes were fixed, so existing
-- history becomes visible in the reports instead of staying invisible forever.
--
-- Join is on CrmServiceBusiness.businessId, which is the platform Business id --
-- the exact value the old write paths stored in CrmActivity.businessId. It is
-- `@unique`, so at most one row matches and the update cannot fan out.
--
-- Rows with a NULL businessId, or a businessId with no enrolled service
-- business, are left untouched. There is no correct tenant to attribute them to,
-- and inventing one would be worse than leaving them unattributed.

UPDATE "CrmActivity" a
SET "serviceBusinessId" = sb."id"
FROM "crm_service_businesses" sb
WHERE sb."businessId" = a."businessId"
  AND a."serviceBusinessId" IS NULL
  AND a."businessId" IS NOT NULL;