-- CrmJob ↔ SolanaEscrow
--
-- The escrow chain was dead at the root, not at the wiring.
--
-- `CrmJob.escrowStatus` is read in three places — the job detail panel, `getClientStage`'s
-- hasDefaultedEscrow branch, and the "escrow held over 30 days" alert — and nothing has
-- ever written it. The three event-bus subscribers that set it are complete, correct and
-- marked durable; nothing emits those events on that bus. The escrow services emit all
-- three to `trustCore.emit`, which is the OTHER trust system and writes passport scores.
-- Two systems, identical event names, two buses — which is why it read as "working but
-- empty".
--
-- It could not simply be wired up, because no escrow record anywhere linked to a job.
-- Nine escrow models exist (Escrow, UniversalEscrow, ServiceEscrow, FreightEscrow,
-- AgentEscrow, CODEscrow, LocalSaleEscrow, SolanaEscrow, EscrowEvent) and every one
-- anchors to a reservation, booking, appointment or payment. None to CrmJob. CrmJob
-- had `bookingId` but Invoice has no bookingId, so a job's money could not be traced
-- from its invoice either.
--
-- ── WHY SOLANAESCROW ────────────────────────────────────────────────────────
--
-- It is the only one of the nine whose shape matches the escrow program that actually
-- exists in this repo (contracts/solana/pabandi_escrow, with a working
-- solana_escrow.service.ts behind it): escrowPda, mint, amount, status, and one
-- transaction signature per transition. Choosing any of the others would have meant
-- building an adapter to an Anchor program that does not exist.
--
-- ── NULLABLE, AND WHY ────────────────────────────────────────────────────────
--
-- Nullable because not every job is escrowed. Escrow is a decision made per job by the
-- business, and a column with a NOT NULL would force a record that means "escrow
-- exists" onto every job in every tenant — which would be a lie for all of them.
--
-- `unique` because one job has at most one escrow. The program derives its PDA from
-- (reservation_id, customer), so a second escrow for the same job would need a second
-- PDA and there is no sensible meaning for two escrows against one piece of work. The
-- unique constraint makes that a database error rather than a silent second row.
--
-- `onDelete: SetNull` because deleting a job must not delete money. The escrow holds
-- funds and has on-chain transactions attached; cascading from a work record onto a
-- financial record is exactly the cascade you do not want. The row survives, detached,
-- and the job's history can be cleaned up without destroying a financial record.

-- ── TABLE NAMES ─────────────────────────────────────────────────────────────
--
-- `CrmJob` carries `@@map("crm_jobs")` and `SolanaEscrow` carries no mapping, so the
-- hand-written SQL uses those two different spellings. The Prisma client applies the
-- mapping and hand-written SQL never does — the same trap as the earlier `crm_clients`
-- and `CrmServiceBusiness` migrations, and the reason this one is dry-run inside a
-- rolled-back transaction before it ships.

ALTER TABLE "SolanaEscrow" ADD COLUMN "jobId" TEXT;

CREATE UNIQUE INDEX "SolanaEscrow_jobId_key" ON "SolanaEscrow"("jobId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SolanaEscrow_jobId_fkey'
  ) THEN
    ALTER TABLE "SolanaEscrow"
      ADD CONSTRAINT "SolanaEscrow_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "crm_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
