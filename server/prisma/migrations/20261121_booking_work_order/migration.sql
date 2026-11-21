-- Link a booking to the coordinator work order it created.
--
-- The FK lives on Booking, matching docs/booking-to-work-order-plan.md. UNIQUE is
-- the idempotency mechanism: at most one work order per booking, and a retry
-- cannot create a second.
--
-- Production runs `prisma migrate deploy` via render.yaml's preDeployCommand, so
-- this must exist as a migration rather than a `db push`.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_workOrderId_key" ON "Booking"("workOrderId");
