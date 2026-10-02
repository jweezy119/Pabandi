-- One escrow per appointment.
--
-- The model declares `appointmentId @unique`, but the original CREATE TABLE for
-- ServiceEscrow omitted the matching UNIQUE constraint — so the database would
-- happily accept a second escrow against the same booking. A retried payment or
-- a double-delivered rail webhook could then release the retainer twice.
--
-- Verified absent before this migration: pg_constraint returned no unique
-- constraints on ServiceEscrow.

ALTER TABLE "ServiceEscrow"
  ADD CONSTRAINT "ServiceEscrow_appointmentId_key" UNIQUE ("appointmentId");
