-- Job assignment and check-in state live on Booking.
--
-- CRM jobs ARE bookings: CrmJob and CrmJobAssignment were removed in the schema
-- purge and nothing replaced them, so `POST /api/v1/crm/jobs/:id/assign` was left
-- as a stub reading "employees are not available in this deployment" and there
-- was no way to record who a job was assigned to, nor to check for double-booking.
--
-- A second assignment table was deliberately NOT introduced: it would mirror
-- Booking one-for-one and nothing else would read it.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkedOutAt" TIMESTAMP(3);

-- The conflict check filters on employeeId across a slotStart window, so without
-- this index every assignment scan reads the business's whole job history.
CREATE INDEX IF NOT EXISTS "Booking_employeeId_idx" ON "Booking"("employeeId");
CREATE INDEX IF NOT EXISTS "Booking_employeeId_slotStart_idx" ON "Booking"("employeeId", "slotStart");
