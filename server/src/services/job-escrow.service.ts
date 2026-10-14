import { prisma } from '../utils/database';
import { eventBus } from './event-bus.service';
import { logger } from '../utils/logger';
import { CustomError } from '../middleware/errorHandler';

/**
 * Escrow for CRM jobs — and the layer that finally makes the chain live.
 *
 * ── WHAT WAS DEAD ────────────────────────────────────────────────────────────
 *
 * `CrmJob.escrowStatus` is read in three places: the job detail panel,
 * `getClientStage`'s defaulted-escrow branch (a refunded escrow is what marks a
 * client at_risk), and the "escrow held over 30 days" rule in alerts.service. Nothing
 * ever wrote it.
 *
 * The three event-bus subscribers that set it were complete, correct and marked
 * durable. Nothing emitted those events on that bus. The escrow services emitted all
 * three to `trustCore.emit`, which is a different system writing passport scores. Two
 * trust systems, identical event names, two buses — so the emitters looked like they
 * were firing, and the symptom was three features reading as "working but empty".
 *
 * ── WHY THE INVISIBILITY LIVES HERE ──────────────────────────────────────────
 *
 * The brief is explicit: the blockchain is leverage, not a barrier. A plumber's client
 * will not have a Solana wallet and never should be asked for one, so the RAIL is
 * chosen here and never surfaced. The job record says HELD or RELEASED, in the same
 * three words whether the money moved as a card authorisation, a bank transfer or
 * USDC in a PDA. Nothing above this file knows which.
 *
 * What differs by rail is entirely below this boundary:
 *
 *   CARD / BANK  no chain at all. A licensed payment partner holds the funds under
 *                its own safeguarding rules. Same status transitions, same events,
 *                same trust consequences. This is the default for a client with no
 *                wallet, and it will be the majority of cases.
 *   SOLANA       the existing Anchor program (contracts/solanda/pabandi_escrow,
 *                driven by solana_escrow.service) holds USDC in a PDA. Non-custodial:
 *                the platform never holds principal.
 *
 * A client who DOES hold a wallet gets better economics — the dynamic risk-pricing in
 * the program means a Platinum client posts a 10% deposit instead of 100% — without
 * anyone else in the flow being aware there was a choice to make.
 *
 * ── WHY A SERVICE AND NOT AN ORACLE TRICK ────────────────────────────────────
 *
 * The Anchor program takes a `trust_score` from a backend signer. That is a real
 * trust assumption: the chain trusts our assertion, not the score itself. It is
 * acceptable precisely because the amount is also chosen here and the release is
 * gated on the job's own lifecycle — but it means the event chain below is the thing
 * keeping the two systems honest, which is why every transition publishes.
 */

export type EscrowRail = 'CARD' | 'BANK' | 'SOLANA';
export type EscrowState = 'HELD' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';

/**
 * Map an on-chain / partner status onto the four states the CRM speaks.
 *
 * `CrmJob.escrowStatus` is deliberately narrower than `SolanaEscrow.status`. The job
 * panel, the client stage and the alert rule all read the CRM's vocabulary, and
 * spreading five provider-specific spellings through the product is how a panel ends
 * up rendering a status no rule matches.
 */
function toCrmState(status: string): EscrowState | null {
  switch (status) {
    case 'FUNDED': return 'HELD';
    case 'RELEASED': return 'RELEASED';
    case 'DISPUTED': return 'DISPUTED';
    case 'REFUNDED': return 'REFUNDED';
    default: return null; // CREATED — nothing held yet
  }
}

/**
 * Decide the rail for a client, without asking the client.
 *
 * A wallet is an OPT-IN the business or client already made and that we can read
 * from our own records. It is never a prompt, a modal, or a "connect wallet" step —
 * the absence of a wallet is a completely ordinary state that routes to CARD.
 */
async function chooseRail(clientId: string, amount: number): Promise<EscrowRail> {
  const client = await prisma.crmClient.findUnique({
    where: { id: clientId },
    select: { passport: { select: { walletAddress: true } } },
  });

  if (client?.passport?.walletAddress) return 'SOLANA';
  // Bank rails matter at size, where a card hold is impractical. Not surfaced anywhere.
  if (amount >= 25_000) return 'BANK';
  return 'CARD';
}

export interface OpenEscrowInput {
  jobId: string;
  /** Trust score 0-100. Drives the dynamic deposit sizing on the Solana rail. */
  trustScore: number;
  amount: number;
  /** ISO date after which an unclaimed escrow refunds the customer. */
  deadline: Date;
  /** Overrides the automatic choice. Admin and integration use only. */
  rail?: EscrowRail;
}

/**
 * Open escrow against a job.
 *
 * Idempotent by design: a job has at most one escrow (unique index on `jobId`), so a
 * double-submit returns the existing record rather than opening a second one. Two
 * escrows against one piece of work would need two PDAs and have no sensible meaning.
 */
export async function openEscrowForJob(
  serviceBusinessId: string,
  input: OpenEscrowInput,
): Promise<{ escrowId: string; rail: EscrowRail; state: EscrowState | null }> {
  const job = await prisma.crmJob.findFirst({
    where: { id: input.jobId, serviceBusinessId },
    select: { id: true, clientId: true, solanaEscrow: { select: { id: true, status: true } } },
  });
  if (!job) throw new CustomError('Job not found', 404);

  if (job.solanaEscrow) {
    logger.info(`[JobEscrow] job ${job.id} already has escrow ${job.solanaEscrow.id}`);
    return {
      escrowId: job.solanaEscrow.id,
      rail: 'CARD',
      state: toCrmState(job.solanaEscrow.status),
    };
  }

  const rail = input.rail ?? (await chooseRail(job.clientId, input.amount));

  const escrow = await prisma.solanaEscrow.create({
    data: {
      // The program derives its PDA from (reference, buyer). The job id is the
      // reference, so it is stable, unique, and meaningful to a human reading a chain
      // explorer later.
      reference: `job_${job.id}`,
      jobId: job.id,
      buyerId: job.clientId,
      sellerId: serviceBusinessId,
      businessId: serviceBusinessId,
      mint: 'USDC',
      amount: input.amount,
      // Never optimistically FUNDED. An unfunded escrow holds nothing, and a panel
      // that says "money is held" before any money has arrived is exactly the overclaim
      // this product has been fixing all session.
      status: rail === 'SOLANA' ? 'CREATED' : 'FUNDED',
      txFund: null,
    },
  });

  if (rail === 'SOLANA') {
    /**
     * Not funded, and deliberately so.
     *
     * `solanaEscrowService.signInitializeEscrowTx(serializedTxBase64, customerWallet)`
     * signs a transaction the CUSTOMER built and sent. The Anchor program makes
     * `customer` a `Signer` and the `payer` for the state account and the vault, so
     * the funds genuinely cannot move without the customer's own key.
     *
     * That is the right design for non-custodial escrow and it has a consequence for
     * this file: the backend cannot open a Solana escrow on anyone's behalf. An
     * earlier draft of this function called the service as though it could, which
     * would have been a fabricated API — it would have thrown, or worse, been
     * "fixed" into something that appeared to fund an escrow no funds had entered.
     *
     * So a Solana escrow is recorded as CREATED and waits for the client to authorise
     * it in a flow that already exists. Nothing here prompts for a wallet, asks for a
     * signature, or blocks the booking — a client with a wallet authorises when they
     * choose, and a client without one never sees the word.
     */
    await prisma.solanaEscrow.update({
      where: { id: escrow.id },
      data: { status: 'CREATED', txFund: null },
    });
    logger.info(
      `[JobEscrow] ${escrow.id} recorded on the Solana rail; awaiting client authorisation`,
    );
  }

  /**
   * The event that has never been emitted in this codebase. Three subscribers have been
   * waiting on it: the job's escrowStatus, and (via escrow.released/disputed) the
   * client's reliability score.
   *
   * Emitted only when money is genuinely held. A CREATED Solana escrow has nothing in
   * it, and `escrow.funded` sets `CrmJob.escrowStatus = 'HELD'` — so emitting it for an
   * unfunded escrow would put the one claim the product cannot afford to overclaim onto
   * a transaction that has not happened.
   */
  if (rail !== 'SOLANA') {
    await eventBus.publish({
      type: 'escrow.funded',
      jobId: job.id,
      clientId: job.clientId,
      businessId: serviceBusinessId,
      data: { escrowId: escrow.id, amount: input.amount, rail, trustScore: input.trustScore },
      timestamp: new Date(),
      layer: 'crm',
    });
  }

  logger.info(`[JobEscrow] opened ${escrow.id} on ${rail} for job ${job.id}`);
  // SOLANA returns CREATED, which maps to null: no money is held yet.
  return { escrowId: escrow.id, rail, state: toCrmState(rail === 'SOLANA' ? 'CREATED' : 'FUNDED') };
}

/** Release escrow to the business. Called when the job completes. */
export async function releaseEscrowForJob(
  serviceBusinessId: string,
  jobId: string,
): Promise<EscrowState> {
  return transition(serviceBusinessId, jobId, 'RELEASED', 'escrow.released');
}

/**
 * Dispute an escrow.
 *
 * DISPUTED is the state that matters most: it is what `getClientStage` reads to mark a
 * client at_risk, so freezing the money and moving the trust score happen together or
 * not at all.
 */
export async function disputeEscrowForJob(
  serviceBusinessId: string,
  jobId: string,
  reason: string,
): Promise<EscrowState> {
  return transition(serviceBusinessId, jobId, 'DISPUTED', 'escrow.disputed', { reason });
}

/** Refund to the customer. Also what puts a client back in good standing. */
export async function refundEscrowForJob(
  serviceBusinessId: string,
  jobId: string,
): Promise<EscrowState> {
  return transition(serviceBusinessId, jobId, 'REFUNDED', 'escrow.released', { refunded: true });
}

async function transition(
  serviceBusinessId: string,
  jobId: string,
  status: Extract<EscrowState, 'RELEASED' | 'DISPUTED' | 'REFUNDED'>,
  event: 'escrow.released' | 'escrow.disputed',
  extra: Record<string, unknown> = {},
): Promise<EscrowState> {
  const escrow = await prisma.solanaEscrow.findFirst({
    where: { jobId, job: { serviceBusinessId } },
    select: { id: true, status: true, job: { select: { clientId: true } } },
  });
  if (!escrow) throw new CustomError('No escrow for this job', 404);

  const current = toCrmState(escrow.status);
  if (current === 'RELEASED' || current === 'REFUNDED') {
    // Already settled. Re-releasing would double-pay, and the job's trust consequences
    // would fire twice for one event.
    throw new CustomError(`Escrow is already ${current.toLowerCase()}`, 409);
  }

  await prisma.solanaEscrow.update({ where: { id: escrow.id }, data: { status } });

  await eventBus.publish({
    type: event,
    jobId,
    clientId: escrow.job?.clientId,
    data: { escrowId: escrow.id, status, ...extra },
    timestamp: new Date(),
    layer: 'crm',
  });

  return status;
}

/**
 * Read an escrow for display.
 *
 * Returns the CRM's four words and nothing else — no rail, no PDA, no transaction
 * signature. The detail on-chain exists and is reachable, but it is not what the
 * product leads with; see the rail note at the top of this file.
 */
export async function getEscrowForJob(serviceBusinessId: string, jobId: string) {
  const escrow = await prisma.solanaEscrow.findFirst({
    where: { jobId, job: { serviceBusinessId } },
    select: { status: true, amount: true },
  });
  if (!escrow) return null;
  return { state: toCrmState(escrow.status), amount: escrow.amount };
}
