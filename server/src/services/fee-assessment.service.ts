/**
 * Fee assessment — turning a charge into a fee the merchant owes.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE FEE ENGINE
 * `config/fees.ts` answers "what should this cost". This answers "has this
 * already been charged for, and does the merchant already know". Those are
 * different questions with different failure modes: the first is wrong when the
 * arithmetic is wrong, the second is wrong when the same charge is recorded
 * twice or silently not at all.
 *
 * WHY IT IS AN ACCRUAL
 * Payments settle into the merchant's own Square account. Pabandi never holds the
 * money, so there is no percentage to take at the point of charge. The fee is
 * recorded when the charge is created and collected later.
 *
 * THE IDEMPOTENCY KEY IS THE WHOLE DESIGN
 * Invoices get re-sent. Webhooks get replayed. Deposit links get regenerated. Any
 * of those must not bill a merchant twice for one appointment. The unique
 * constraint on `idempotencyKey` is the enforcement, so this does not rely on
 * callers being careful.
 *
 * The key is derived from the source, not generated: `invoice:<id>` and
 * `booking-deposit:<id>` mean the same attempt produces the same key no matter
 * how many times it runs.
 *
 * RATES ARE SNAPSHOTTED
 * Every component of the quote is frozen onto the row. If the schedule changes
 * next month, last month's fees must still reconcile to what was billed — and a
 * merchant reading "4.5%, category SALON x0.75, floored to 3.16% on a $123.45
 * charge" can see exactly why they were charged what they were, without asking.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import {
  quoteFee,
  processingCostCents,
  publicFeeSchedule,
  type FeeQuote,
} from '../config/fees';
import type { BusinessCategory } from '@prisma/client';

/** Namespaced so an invoice id and a booking id can never collide. */
export function feeIdempotencyKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

export interface AssessmentInput {
  businessId: string;
  /** 'invoice' | 'booking_deposit' | something added later. */
  sourceType: string;
  sourceId: string;
  /** The charge this fee is a percentage/flat of, in cents. */
  chargeCents: number;
  /** Defaults to the business's own category. */
  category?: BusinessCategory;
  /** Per-business override; falls back to a column on Business when absent. */
  businessMultiplier?: number | null;
}

export interface AssessmentResult {
  assessmentId: string;
  feeCents: number;
  marginCents: number;
  quote: FeeQuote;
  /** True when an equivalent assessment already existed and was reused. */
  reused: boolean;
}

/**
 * Count of charges a business has already had settled.
 *
 * Feeds the free-transaction allowance. Counts *charges*, not statements or
 * days, because a merchant who books ten appointments in a week has used the
 * allowance and should be charged from the eleventh — an allowance measured in
 * anything but activity would expire for some businesses and never for others.
 */
export async function settledChargeCount(businessId: string): Promise<number> {
  const count = await prisma.feeAssessment.count({
    where: { businessId, status: { not: 'waived' } },
  });
  // The current charge is about to become one of these, so it has not been
  // counted yet. The caller compares against FIRST_TRANSACTION_FREE_LIMIT.
  return count;
}

/**
 * Record the fee for one charge.
 *
 * Returns the existing assessment rather than throwing if the key is already
 * taken — re-sending an invoice is normal and should be silent, not an error.
 */
export async function assessFee(input: AssessmentInput): Promise<AssessmentResult> {
  const idempotencyKey = feeIdempotencyKey(input.sourceType, input.sourceId);

  const existing = await prisma.feeAssessment.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return {
      assessmentId: existing.id,
      feeCents: existing.feeCents,
      marginCents: existing.marginCents,
      quote: {
        rate: existing.rateBps / 10_000,
        feeCents: existing.feeCents,
        marginCents: existing.marginCents,
        tier: existing.tier as FeeQuote['tier'],
        category: existing.category as BusinessCategory,
        applied: (existing.breakdown as string[] | null) ?? [],
        currency: existing.currency,
      },
      reused: true,
    };
  }

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { category: true, currency: true },
  });

  const quote = quoteFee(
    {
      amountCents: input.chargeCents,
      category: input.category ?? business?.category ?? 'OTHER',
      settledTransactions: await settledChargeCount(input.businessId),
      businessMultiplier: input.businessMultiplier ?? null,
    },
    business?.currency ?? 'USD',
  );

  const processing = processingCostCents(input.chargeCents);

  try {
    const row = await prisma.feeAssessment.create({
      data: {
        businessId: input.businessId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        chargeCents: input.chargeCents,
        feeCents: quote.feeCents,
        processingCents: processing,
        marginCents: quote.marginCents,
        rateBps: Math.round(quote.rate * 10_000),
        tier: quote.tier,
        category: quote.category,
        currency: quote.currency,
        status: 'accrued',
        breakdown: quote.applied,
        idempotencyKey,
      },
    });

    logger.info(
      `[Fees] Assessed ${quote.feeCents}c on a ${input.chargeCents}c ${input.sourceType} ` +
        `for business ${input.businessId} (${quote.tier}, margin ${quote.marginCents}c).`,
    );

    return {
      assessmentId: row.id,
      feeCents: quote.feeCents,
      marginCents: quote.marginCents,
      quote,
      reused: false,
    };
  } catch (err: any) {
    // Lost a create race against a concurrent send of the same invoice. The other
    // writer's row is the correct one — ours would be identical, keyed the same.
    if (err?.code === 'P2002') {
      const raced = await prisma.feeAssessment.findUnique({ where: { idempotencyKey } });
      if (raced) {
        return {
          assessmentId: raced.id,
          feeCents: raced.feeCents,
          marginCents: raced.marginCents,
          quote: {
            rate: raced.rateBps / 10_000,
            feeCents: raced.feeCents,
            marginCents: raced.marginCents,
            tier: raced.tier as FeeQuote['tier'],
            category: raced.category as BusinessCategory,
            applied: (raced.breakdown as string[] | null) ?? [],
            currency: raced.currency,
          },
          reused: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Record the fee, tolerating failure.
 *
 * Fee assessment must never block a customer being charged or a merchant being
 * served. A merchant who cannot pay an invoice because we failed to record our own
 * fee will notice, and they will be right to. The failure is logged loudly enough
 * to find, and the charge proceeds.
 */
export async function assessFeeSafe(input: AssessmentInput): Promise<AssessmentResult | null> {
  try {
    return await assessFee(input);
  } catch (err) {
    logger.error(
      `[Fees] Failed to assess fee for ${input.sourceType} ${input.sourceId}: ` +
        `${err instanceof Error ? err.message : err}. The charge proceeds unassessed — ` +
        `this revenue is now untracked and needs backfilling.`,
    );
    return null;
  }
}

/** Total unbilled fees for a business, in cents. */
export async function unbilledTotalCents(businessId: string): Promise<number> {
  const agg = await prisma.feeAssessment.aggregate({
    where: { businessId, status: 'accrued' },
    _sum: { feeCents: true },
  });
  return agg._sum.feeCents ?? 0;
}

/**
 * A merchant's fee history, with the reason each fee was what it was.
 *
 * This is what makes the schedule defensible. A merchant reading "you owe $4.90"
 * can then read "4.5%, floored to 3.16% because a 25% category discount would put
 * it below what Square charges to process the card" — which is a much easier
 * conversation than being asked to trust a total.
 */
export async function feeHistory(businessId: string, limit = 50) {
  const rows = await prisma.feeAssessment.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      chargeCents: true,
      feeCents: true,
      marginCents: true,
      rateBps: true,
      tier: true,
      category: true,
      currency: true,
      status: true,
      breakdown: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    rate: r.rateBps / 10_000,
    ratePercent: (r.rateBps / 100).toFixed(2),
    applied: (r.breakdown as string[] | null) ?? [],
  }));
}

/**
 * Realised margin over a period.
 *
 * Sums what we actually kept after processing rather than what we billed,
 * because those are different numbers and only one of them is the business's
 * result. Negative here means we were subsidising transactions and should look
 * at the rates rather than the volume.
 */
export async function realisedMargin(
  businessId: string,
  since?: Date,
): Promise<{ assessedCents: number; marginCents: number; transactions: number }> {
  const agg = await prisma.feeAssessment.aggregate({
    where: { businessId, ...(since ? { createdAt: { gte: since } } : {}) },
    _sum: { feeCents: true, marginCents: true },
    _count: { _all: true },
  });
  return {
    assessedCents: agg._sum.feeCents ?? 0,
    marginCents: agg._sum.marginCents ?? 0,
    transactions: agg._count._all,
  };
}

export { publicFeeSchedule };
