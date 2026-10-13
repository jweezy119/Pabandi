-- CrmClient.company
--
-- ClientFormModal has rendered a "Company (Optional)" input since it was written.
-- There was no column for it and `addClient` destructured a fixed field list that
-- did not include it, so the value was accepted by the form, ignored by the server,
-- and lost — with no error anywhere. A field that silently discards what people type
-- is worse than no field at all, because it teaches them the CRM does not listen.
--
-- Nullable String, no index: it is displayed and searched over, never joined on.

-- The table is `crm_clients`, not `CrmClient`: the Prisma model carries
-- `@@map("crm_clients")` and hand-written migration SQL does not get that
-- mapping applied. Caught by dry-running inside a transaction — the same mistake
-- as the previous migration, which is why this one is checked before it ships.
ALTER TABLE "crm_clients" ADD COLUMN "company" TEXT;
