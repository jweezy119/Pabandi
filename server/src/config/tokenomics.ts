/**
 * Centralized $PAB tokenomics levers.
 * Tuned for: real revenue (value-based fee), gentle deflation (burn),
 * and controlled utilization (proceeds allocated to product-driving buckets).
 *
 * Fee = FEE_RATE of booking value (with MIN_FEE_PAB floor for micro-bookings).
 * Of the fee: BURN_SHARE is burned (deflation); the remainder is split across
 * treasury buckets that fund the actual rails (LP liquidity, yield, ops, reserve).
 */
import { prisma } from '../utils/database';
import { recordTribute } from '../services/treasury.service';
import { logger } from '../utils/logger';

export const TOKENOMICS = {
  /** Platform fee on booking value. 2% — below Stripe (2.9%+) and far below Upwork (10-20%). */
  FEE_RATE: 0.02,
  /** Floor so tiny bookings still cover gas + are economically meaningful. */
  MIN_FEE_PAB: 1,
  /** Share of the fee permanently burned (deflation). ~0.24%/yr of ~1B supply at scale. */
  BURN_SHARE: 0.12,
  /** Allocation of the post-burn fee across treasury buckets (sums to 1.0). */
  ALLOCATION: {
    LP_PROVISION: 0.35, // fund off-ramp / payout liquidity → rails actually work
    OPERATING: 0.25, // runway + control
    YIELD_REINVEST: 0.25, // compound treasury growth → utilization of capital
    EMERGENCY: 0.15, // reserve / safety → control
  },
  /** Notional PAB value of one simulated self-economy booking (demo visibility). */
  SIM_BOOKING_VALUE_PAB: 1000,
  /** Flat $PAB fee to run one background check (anti-abuse monetization). */
  PAB_FEE_PER_CHECK: 5,
} as const;

/** Flat $PAB fee to run one background check (anti-abuse monetization). */
export const PAB_FEE_PER_CHECK = 5;

/** Flat $PAB fee to issue one Agent Capability Passport (the metered economic event). */
export const PAB_FEE_PER_PASSPORT = 2;

/** Foolproof abuse cap: max Agent Passport issues per owner per day. */
export const PASSPORT_MAX_ISSUES_PER_DAY = 50;

/** Fee for a booking of `amountPab` (value-based, with floor). */
export const computeFee = (amountPab: number): number => {
  const raw = amountPab * TOKENOMICS.FEE_RATE;
  return Math.max(TOKENOMICS.MIN_FEE_PAB, Math.round(raw));
};

/** Deflationary burn for a given fee. */
export const computeBurn = (fee: number): number => +(fee * TOKENOMICS.BURN_SHARE).toFixed(2);

/**
 * Records the full economic footprint of one booking fee:
 *  - BURN (deflation) as an AgentTransaction
 *  - the post-burn remainder allocated across treasury buckets (LP/OPS/YIELD/EMERGENCY)
 *    as treasuryPositions, so the Economy dashboard shows real utilization + control.
 */
export const recordBookingEconomics = async (params: {
  agentId: string;
  fromAddress: string;
  fee: number;
}): Promise<void> => {
  const { agentId, fromAddress, fee } = params;
  const burnPab = computeBurn(fee);
  const netFee = +(fee - burnPab).toFixed(2);

  try {
    // Deflationary burn
    await prisma.agentTransaction.create({
      data: {
        agentId,
        type: 'BURN',
        amount: burnPab,
        fromAddress,
        toAddress: 'burn',
      } as any,
    });

    // Fee collected (net of burn) — feeds /economy/stats feesCollected
    await prisma.agentTransaction.create({
      data: {
        agentId,
        type: 'FEE_COLLECTION',
        amount: netFee,
        fromAddress,
        toAddress: process.env.PABANDI_TREASURY_WALLET || 'treasury',
      } as any,
    });

    // Allocate the net fee across product-driving buckets
    for (const [bucket, share] of Object.entries(TOKENOMICS.ALLOCATION)) {
      const amount = +(netFee * share).toFixed(2);
      if (amount <= 0) continue;
      await recordTribute({
        amount,
        bucket: bucket as any,
        meta: { type: 'BOOKING_FEE', source: fromAddress },
      });
    }
  } catch (err: any) {
    logger.warn('[Tokenomics] booking economics record skipped:', err.message);
  }
};
