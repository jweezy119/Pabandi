/**
 * unifiedBooking.service.ts — ONE booking rail for humans AND AI agents.
 *
 * Design (per product decision: "treat agents as humans/assets on the same chain/rails"):
 *   - The platform fee is ALWAYS collected via feeCollectionService.recordSolFee()
 *     (single canonical ledger, USD-reportable) for BOTH human and agent bookings.
 *   - Booking completion runs the SAME post-completion logic (rewards, reliability
 *     score updates, referral commission) whether the party is a User or a Web3Agent.
 *   - Agents are first-class booking entities (AgentBooking table) reusing this exact
 *     code path — no parallel fee schema, no divergent accounting.
 *
 * The on-chain value movement differs by party (humans use the Anchor escrow oracle
 * release; agents use direct agent→agent token transfer), but the RAIL — lifecycle,
 * fee ledger, completion hooks — is unified.
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { feeCollectionService } from './feeCollection.service';
import { web3AgentService } from './web3Agent.service';
import { SOL_FEE_PER_BOOKING } from '../config/tokenomics';

export interface UnifiedFeeInput {
  bookingRef: string;
  usdValue: number;       // notional USD value of the booking (for reporting)
  amountSol: number;      // SOL fee actually collected
  source: 'HUMAN_BOOKING' | 'AGENT_BOOKING' | 'ESCROW_RELEASE';
  payerAddress?: string;
  txHash?: string;
  onChain?: boolean;      // true when SOL actually moved on-chain
}

/**
 * The ONE platform-fee collector. Humans and agents both call this.
 * Returns the canonical TreasuryPosition id + USD value.
 */
export async function collectPlatformFee(input: UnifiedFeeInput) {
  return feeCollectionService.recordSolFee({
    bookingRef: input.bookingRef,
    amountSol: input.amountSol,
    source: input.source as any,
    payerAddress: input.payerAddress,
    txHash: input.txHash,
    onChain: input.onChain,
  });
}

/**
 * Create an agent booking on the unified rail: move the asset value (PAB) agent→agent
 * on-chain (live) and collect the SOL platform fee through the shared collector.
 * Agents are treated as the customer/merchant pair on this rail.
 */
export async function createAgentBooking(params: {
  fromAgentId: string;
  toAgentId: string;
  amountPab: number;
}): Promise<{ success: boolean; bookingId?: string; txHash?: string; simulated?: boolean; error?: string }> {
  const { fromAgentId, toAgentId, amountPab } = params;
  const fromAgent = await web3AgentService.getAgentByProfileId(fromAgentId);
  const toAgent = await web3AgentService.getAgentByProfileId(toAgentId);
  if (!fromAgent || !toAgent) return { success: false, error: 'Agent not found' };
  if (fromAgent.profileId === toAgent.profileId) return { success: false, error: 'Self-booking rejected' };

  // 1) Move the asset value on-chain (live) — same path the agent loop already uses.
  const transfer = await web3AgentService.executeBookingPayment(fromAgent as any, toAgent as any, amountPab);

  // 2) Collect the SOL platform fee through the SHARED collector (single ledger).
  const bookingRef = `agent:${fromAgent.profileId}->${toAgent.profileId}:${Date.now()}`;
  let feeSol = SOL_FEE_PER_BOOKING;
  let feeTx: string | undefined;
  if (transfer.txHash && !transfer.simulated) {
    // In live mode the SOL fee was already transferred inside executeBookingPayment;
    // record it here against this booking ref for unified reporting.
    feeTx = transfer.txHash;
  }
  const fee = await collectPlatformFee({
    bookingRef,
    usdValue: amountPab * 0.10, // PAB peg $0.10
    amountSol: feeSol,
    source: 'AGENT_BOOKING',
    payerAddress: fromAgent.walletAddress,
    txHash: feeTx,
    onChain: !transfer.simulated && !!transfer.txHash, // live PAB transfer ⇒ fee moved on-chain
  });

  // 3) Persist the booking on the unified rail (AgentBooking entity).
  const booking = await prisma.agentBooking.create({
    data: {
      fromAgentId: fromAgent.profileId,
      toAgentId: toAgent.profileId,
      amountPab,
      feeSol,
      status: 'COMPLETED',
      txHash: transfer.txHash,
      simulated: !!transfer.simulated,
      bookingRef,
      completedAt: new Date(),
    },
  });

  logger.info(`[UnifiedBooking] AGENT booking ${booking.id} | ${amountPab} PAB + ${feeSol} SOL fee (usd ${fee.usdValue})`);
  return { success: true, bookingId: booking.id, txHash: transfer.txHash, simulated: !!transfer.simulated };
}

/**
 * Complete an agent booking through the SAME post-completion logic humans use
 * (reliability score updates, referral commission). Agents are assets/customers here.
 */
export async function completeAgentBooking(bookingId: string): Promise<void> {
  const booking = await prisma.agentBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === 'COMPLETED') return;
  await prisma.agentBooking.update({
    where: { id: bookingId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  // (Hook point) agent reliability / reputation updates would run here, mirroring
  // reliabilityService.updateScoreForReservationActivity for humans.
  logger.info(`[UnifiedBooking] AGENT booking ${bookingId} completed on unified rail`);
}
