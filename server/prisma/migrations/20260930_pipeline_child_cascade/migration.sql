-- Let a lead be deleted even when it has deals or activities.
--
-- `pipeline_deals.leadId` and `pipeline_activities.leadId` were declared
-- RESTRICT, so DELETE /api/v1/contact/contacts/:id failed with a foreign-key
-- violation for any contact that had history — which is most of them. A CRM
-- where you cannot delete a contact is a CRM that accumulates stale rows
-- forever and quietly stops matching reality.
--
-- Cascade is the correct semantic here: a deal or an activity has no meaning
-- without the lead it belongs to, and both are already reachable only through
-- that lead. Nothing of financial or historical value is lost — unlike
-- `Invoice.clientId`, which deliberately stays RESTRICT so an invoice can never
-- be orphaned from the client it bills.
--
-- The schema models already declared onDelete: Cascade; this aligns the
-- database with them.

ALTER TABLE "pipeline_deals"
  DROP CONSTRAINT IF EXISTS "PipelineDeal_leadId_fkey";
ALTER TABLE "pipeline_deals"
  ADD CONSTRAINT "PipelineDeal_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "pipeline_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipeline_activities"
  DROP CONSTRAINT IF EXISTS "PipelineActivity_leadId_fkey";
ALTER TABLE "pipeline_activities"
  ADD CONSTRAINT "PipelineActivity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "pipeline_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
