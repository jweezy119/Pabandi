-- CrmClient totalJobs / totalSpent / lastJobAt backfill
--
-- All three columns existed and were rendered: the clients table sorts and displays
-- them as a job count and as LTV, and the dashboard reads the same values. No create,
-- update or lifecycle path in the codebase ever wrote them, so every client in every
-- tenant showed zero jobs and zero lifetime value -- identically for a lead added
-- this morning and a customer of ten years.
--
-- Derived from the rows that define them rather than accumulated:
--   totalJobs  COUNT of the client's COMPLETED jobs
--   totalSpent SUM of subtotal over the client's PAID invoices only
--   lastJobAt  MAX(completedAt) over the same completed jobs
--
-- PAID, not sent: an invoice that has been issued but not paid is a request for
-- money, not money received, and counting it would make LTV a measure of billing
-- rather than of earnings.
--
-- `lastJobAt` is deliberately left NULL when the client has no completed job, which
-- is a real state rather than a missing value to be papered over with epoch zero.
--
-- ── TABLE NAMES ─────────────────────────────────────────────────────────────
--
-- `crm_clients` and `crm_jobs` are both `@@map`ped in the schema. The Prisma client
-- applies those mappings; SQL written by hand never does. This statement originally
-- said "CrmClient", ran on production at 2026-10-13 17:09, and FAILED on
-- `relation "CrmClient" does not exist` -- which aborted Render's preDeploy and left
-- the API frozen on the previous deploy for a day.
--
-- The identical trap is documented at length in the 20261013 migration that added
-- `crm_clients.company`, and it was still walked into. Both names below are verified
-- against the schema's @@map, not inferred from the model name.
--
-- Both tables are named by their mapped form here. CrmActivity, used by the sibling
-- migration, genuinely has no mapping and is genuinely spelled `CrmActivity`.

UPDATE "crm_clients" c
SET
  "totalJobs" = COALESCE((
    SELECT COUNT(*) FROM "crm_jobs" j
    WHERE j."clientId" = c."id" AND j."status" = 'COMPLETED'
  ), 0),
  "lastJobAt" = (
    SELECT MAX(j."completedAt") FROM "crm_jobs" j
    WHERE j."clientId" = c."id" AND j."status" = 'COMPLETED'
  ),
  "totalSpent" = COALESCE((
    SELECT SUM(i."subtotal") FROM "Invoice" i
    WHERE i."clientId" = c."id" AND i."status" = 'paid'
  ), 0);