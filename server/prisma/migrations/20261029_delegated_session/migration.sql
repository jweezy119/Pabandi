-- Delegated (agent-on-behalf-of-human) session columns on PabandiSession.
--
-- All five are nullable and purely additive: existing rows keep their values,
-- and on Aliyun RDS each ADD COLUMN is a single metadata-only statement with no
-- table rewrite, so `prisma migrate deploy` applies them safely against the
-- live production database.
--
--   delegatedByAgentId  the external AI agent that opened the handoff
--   handoffUrl          the unique link handed to the human to fund it
--   serviceId           the service being booked (agent's canonical reference)
--   serviceLabel        human-readable service name for the handoff UI
--   webhookUrl          where to POST session.funded (agent-supplied, optional)

ALTER TABLE "PabandiSession" ADD COLUMN "delegatedByAgentId" TEXT;
ALTER TABLE "PabandiSession" ADD COLUMN "handoffUrl" TEXT;
ALTER TABLE "PabandiSession" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "PabandiSession" ADD COLUMN "serviceLabel" TEXT;
ALTER TABLE "PabandiSession" ADD COLUMN "webhookUrl" TEXT;
