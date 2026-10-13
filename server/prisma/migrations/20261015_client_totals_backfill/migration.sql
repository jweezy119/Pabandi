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
-- CrmJob is mapped to `crm_jobs` in the schema and CrmActivity and CrmClient are
-- not mapped at all, so the hand-written SQL below uses all three spellings. This
-- statement is dry-run inside a rolled-back transaction before it ships, for the same
-- reason the earlier migrations were: the mapping is applied by the Prisma client,
-- never to SQL typed by hand.

UPDATE "CrmClient" c
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