/**
 * engine-deposit.service.ts — the Engine's deposit decision.
 *
 * ─── WHY THIS LIVES APART FROM THE CRM QUOTE ────────────────────────────────
 * `deposit-policy.service.ts` quotes a deposit for a CrmClient against a
 * business. The engine's callers are not CRM clients: they are an arbitrary
 * user or agent holding an open session, and a session carries ownerType/
 * ownerId, not a CRM identity. The band arithmetic is shared — bandForScore,
 * applyBand, the 50% ceiling — but the identity lookup and the checkout-URL leg
 * are different, which is what this file adds.
 *
 * ─── HOW THE SCORE ARRIVES ──────────────────────────────────────────────────
 * The score comes from resolveTrustScore, which returns the 0-1000 platform
 * scale. `bandForScore` normalises anything above 100 by /10 at the boundary
 * (see normalizeScore), so the same session brain that sizes the tab sizes the
 * deposit: a score of 800 clears band A and the deposit is waived outright —
 * the same threshold that grants the $1000/30-day session tier, which is one
 * number doing one consistent job rather than two numbers that could drift.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { resolveTrustScore } from './trust.service';
import {
  applyBand,
  bandForScore,
  isBlocked,
  type DepositQuote,
} from './deposit-policy.rules';
import { paymentRails } from '../payments/rails';

export interface DepositRequirement {
  /** What the customer is asked to fund, in `currency`. */
  amount: number;
  currency: string;
  /** The band that shaped the amount, for display and audit. */
  band: string | null;
  /** The score that chose the band, on the 0-1000 platform scale. */
  score: number | null;
  /** The customer-facing reason. Same strings as the CRM quote. */
  explanation: string;
  /**
   * Where to fund the deposit, from the business's own default payment rail
   * (Square link, SafePay page, Solana transfer URI...). Null when the
   * business has no collectible rail configured — a bank transfer rail has no
   * URL — in which case the client must tell the user the deposit is owed
   * rather than silently booking past it.
   */
  checkoutUrl: string | null;
}

export type DepositOutcome =
  /** Business asks for nothing, or the band waived it. */
  | { required: false; deposit: null; waived: { band: string | null; score: number; explanation: string } | null }
  | { required: true; deposit: DepositRequirement; waived: null };

/**
 * Decide whether this engine booking actions a deposit.
 *
 * Mirrors the rules the public booking route applies (bookings.routes.ts):
 * percentage beats flat amount when both are set, the band scales whatever
 * the business asks, and the amount is clamped to the published 50%-of-value
 * ceiling. Only the identity side differs — CRM passport vs platform score.
 */
export async function evaluateBookingDeposit(params: {
  businessId: string;
  ownerType: 'user' | 'agent';
  ownerId: string;
  /** The value of the thing being booked; anchors the 50% ceiling. */
  bookingValue: number;
}): Promise<DepositOutcome> {
  const business = await prisma.business.findUnique({
    where: { id: params.businessId },
    select: {
      currency: true,
      requireDeposit: true,
      depositAmount: true,
      depositPercentage: true,
    },
  });

  // A business that does not exist (or an osm-* style external id the
  // catalogue has not materialised yet) has no policy to consult. This is the
  // deliberate inverse of the storefront, which reports unknown as "not found":
  // here the question is not "what does this business look like" but "does this
  // booking need money held", and a business we cannot read asked for nothing.
  if (!business) {
    return { required: false, deposit: null, waived: null };
  }

  const hasPercentage =
    business.depositPercentage !== null && business.depositPercentage > 0;
  const hasFlatAmount = business.depositAmount !== null && business.depositAmount > 0;

  // requireDeposit with no figure beside it asks for nothing collectible —
  // same finding as the storefront's `hasDepositAmount` guard.
  if (!business.requireDeposit || (!hasPercentage && !hasFlatAmount)) {
    return { required: false, deposit: null, waived: null };
  }

  const currency = business.currency ?? 'USD';

  const base = hasPercentage
    ? (Number(params.bookingValue) * Number(business.depositPercentage)) / 100
    : Number(business.depositAmount);

  if (!Number.isFinite(base) || base <= 0) {
    return { required: false, deposit: null, waived: null };
  }

  const trust = await resolveTrustScore(params.ownerType, params.ownerId);

  // resolveTrustScore clamps to 0..1000, so the band is always A-D. Kept the
  // isBlocked guard anyway: if the clamp ever loosens, an unreadable score
  // falls back to the standard ask (the no-history quote) rather than crashing
  // a booking that has already been debited on its session.
  const band = isBlocked(bandForScore(trust.score)) ? null : bandForScore(trust.score);

  const quote: DepositQuote = band
    ? applyBand(base, band, trust.score, currency, params.bookingValue)
    : applyBand(base, 'C', null, currency, params.bookingValue);

  if (quote.amount <= 0) {
    return {
      required: false,
      deposit: null,
      waived: { band: quote.band, score: trust.score, explanation: quote.explanation },
    };
  }

  const checkoutUrl = await depositCheckoutUrl({
    businessId: params.businessId,
    amount: quote.amount,
    currency: quote.currency,
    reference: `engine-deposit-${params.businessId}-${trust.score > 0 ? trust.score : 'unknown'}`,
  });

  return {
    required: true,
    deposit: {
      amount: quote.amount,
      currency: quote.currency,
      band: quote.band,
      score: trust.score,
      explanation: quote.explanation,
      checkoutUrl,
    },
    waived: null,
  };
}

/**
 * Where to fund the deposit, from the business's own default payment rail.
 *
 * Deposits are collected by the merchant's own account (see the note at the
 * top of deposit-policy.rules.ts — Pabandi holds no funds), so the URL is
 * whatever the business's configured rail hands back for this amount: a
 * Square hosted link, a SafePay checkout page, a Solana USDC transfer URI.
 *
 * Deliberately does not mint a per-deposit Square link the way the public
 * booking route does. That path exists when a booking row already exists with
 * a Square connection and idempotency anchor; here the engine is answering an
 * authorisation call, possibly on behalf of an agent, and the goal of the URL
 * is to move the user off the recommendation and to a payable page without a
 * provider call in the request path.
 */
export async function depositCheckoutUrl(params: {
  businessId: string;
  amount: number;
  currency: string;
  reference: string;
}): Promise<string | null> {
  const method = await prisma.businessPaymentMethod.findFirst({
    where: { businessId: params.businessId, isDefault: true },
    select: { railId: true, target: true },
  });

  if (!method) {
    return null;
  }

  const rail = paymentRails[method.railId];
  if (!rail) {
    logger.warn(
      `[EngineDeposit] business ${params.businessId} has default rail '${method.railId}' which is not in the rail table`
    );
    return null;
  }

  const url = rail.getPaymentUrl(method.target, {
    amount: params.amount,
    reference: params.reference,
    currency: params.currency,
  });

  // A rail that cannot express a URL (bank transfer) yields ''; null reports
  // "no URL" rather than a broken link.
  return url && url.length > 0 ? url : null;
}
