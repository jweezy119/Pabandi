/**
 * Shariah compliance policy — enforced in code, not documented in a PDF.
 *
 * Why this is code: the risky thing about a compliance stance is not that it is
 * wrong, it is that it quietly stops being true as the product grows. A late-fee
 * feature added in a hurry, a deposit slider someone can push to 90%, a surge
 * multiplier on a haircut — each is individually defensible and collectively is
 * exactly what the platform promised not to be. Putting the boundary here means
 * it is enforced by the compiler and by tests, and any deviation is a visible
 * diff rather than a judgement call made at 2am.
 *
 * This is a product-and-engineering control. It is NOT a fatwa and does not
 * substitute for one: a qualified Shariah board must review the final policy and
 * the financial structures behind it. What this file does is guarantee the
 * application cannot quietly do the thing the policy forbids.
 *
 * Sources of the reasoning, in the vocabulary this codebase uses:
 *   • Riba       — prohibited interest/usury in lending and debt.
 *   • Gharar     — excessive uncertainty, ambiguity or deception in a contract.
 *   • Maysir     — speculation / gambling; risk passed on for gain.
 *   • Najasy     — a grossly misleading representation of the thing sold.
 *   • Amanah     — safekeeping: the holder is a trustee, never a beneficial owner.
 *
 * ── Design decisions ─────────────────────────────────────────────────────────
 *
 * Escrow here is AMANAH, not a loan and not a sale. The platform (through a
 * licensed partner rail) holds the customer's money as a trustee and returns it.
 * It does not advance against it, does not price the customer's balance, and
 * does not earn a return on it. The platform's only legitimate income is a fee
 * for the settlement service, disclosed on the invoice — never a percentage of
 * the held balance and never interest.
 *
 * The booking retainer (Salon parlance would be "advance" / "booking amount") is
 * capped and evidence-bound: it may only ever be a partial contribution toward
 * cost the business can actually point to. That is what keeps a non-refundable
 * booking charge from becoming an unqualified unilateral penalty — which under
 * gharar is unenforceable in a Shariah-compliant structure and, regardless of
 * theology, is the thing that makes customers distrust a marketplace.
 */

import { CustomError } from '../middleware/errorHandler';

export const SHARIA = {
  /** Declared posture. Surfaced in the UI so customers can see the commitment. */
  POSTURE: {
    escrowClassification: 'AMANAH' as const,
    moneyMovementBasis: 'DISCLOSED_SERVICE_FEE' as const,
    holdInterestFree: true,
    scope: 'service_bookings' as const,
  },

  /**
   * Escrow held under amanah. The trustee may not benefit from safekeeping.
   */
  escrow: {
    /** Funds may not be invested, lent or used to generate return for the holder. */
    holderMayEarnReturn: false,
    /** Releasing funds must not require the holder's discretion. */
    releaseMustBeObjective: true,
    /** A dispute route must exist that does not depend on either party's goodwill. */
    disputeRouteRequired: true,
  },

  /**
   * Booking retainer.
   *
   * Capped as a share of price so it stays a contribution toward genuine cost
   * rather than becoming a penalty by another name. `maxBps` is the hard ceiling;
   * a business may charge less, never more.
   */
  retainer: {
    maxBps: 5000, // 50% of the service price
    /** If the business cancels, or cannot deliver, the retainer is returned in full. */
    refundableIfProviderCancels: true,
    refundableIfBusinessCannotDeliver: true,
    /** Refund is always allowed when the service is delivered late or short. */
    refundableOnServiceNotDelivered: true,
    /**
     * A retainer may only be retained against documented actual cost incurred
     * (for example a stock product already consumed). Never against lost profit.
     */
    mayExceedDocumentedActualCost: false,
  },

  /**
   * Riba. Nothing here may accrue interest on an amount owed.
   */
  riba: {
    interestOnDebtAllowed: false,
    /** Late compensation must be documented actual cost, never a rate on the balance. */
    lateFeeBasis: 'DOCUMENTED_ACTUAL_COST' as const,
    /** Even documented cost is capped, so a small debt cannot become a large burden. */
    maxLateFeeBps: 1000, // 10% of the outstanding amount
    /** Small balances may be written off rather than escalated. */
    enforceBelowAmount: 500,
  },

  /**
   * Gharar. The contract must be specified before money moves. These are the
   * fields that must be known and fixed at the moment an escrow is created —
   * not settled later, and not "confirmed on arrival".
   */
  gharar: {
    requirePricedService: true,
    requireKnownDuration: true,
    requireKnownProvider: true,
    requireKnownPrice: true,
    /** A surge/peak multiplier on a booked service is speculative pricing. */
    requireNoSurgePricing: true,
    /** Cancellation terms must be disclosed and accepted before payment. */
    requireTermsAccepted: true,
  },

  /** Maysir. No risk priced into a fixed-price service. */
  maysir: {
    dynamicServicePricingAllowed: false,
    /** Loyalty/reward credit is a discount on future service, not a return on money held. */
    rewardCreditIsDiscountNotInterest: true,
  },

  /**
   * Najasy. The listing must not overstate what is being sold.
   */
  najasy: {
    /** A service may not be advertised at a price it will not honour. */
    priceMustBeHonoured: true,
    /** Testimonials and ratings must not be attributed to uninvolved parties. */
    unattributedTestimonialsAllowed: false,
    /** Deposit/refund terms must be stated on the listing, not revealed at payment. */
    termsVisibleBeforePayment: true,
  },
} as const;

// ─── Guards ───────────────────────────────────────────────────────────────────

const BPS = 10_000;

/**
 * Enforce the retainer cap. Returns the maximum permitted retainer for a price.
 * A business asking for more gets a hard failure rather than silent truncation —
 * silently capping a money figure is how a business ends up confused about what
 * it collected.
 */
export function maxPermittedRetainer(price: number): number {
  return Math.round(price * (SHARIA.retainer.maxBps / BPS));
}

export function assertRetainerWithinPolicy(price: number, retainer: number): void {
  if (retainer < 0) {
    throw new CustomError('Retainer cannot be negative', 400);
  }
  const allowed = maxPermittedRetainer(price);
  if (retainer > allowed) {
    throw new CustomError(
      `Retainer of ${retainer} exceeds the permitted maximum of ${allowed} ` +
        `for a price of ${price}. Shariah policy caps a booking retainer at ` +
        `${SHARIA.retainer.maxBps / 100}% of price so it cannot function as an ` +
        `unilateral penalty.`,
      400
    );
  }
}

/**
 * Reject interest-bearing late fees. `documentedCost` is what the business can
 * evidence it actually lost; anything above it is profit, not compensation.
 */
export function assertLateFeeIsCompensationNotInterest(
  outstanding: number,
  charge: number,
  documentedCost: number
): void {
  if (charge < 0) throw new CustomError('Late fee cannot be negative', 400);

  const cap = Math.round(outstanding * (SHARIA.riba.maxLateFeeBps / BPS));
  if (charge > cap) {
    throw new CustomError(
      `Charge of ${charge} exceeds the compensation cap of ${cap} on an ` +
        `outstanding balance of ${outstanding}.`,
      400
    );
  }
  if (charge > documentedCost) {
    throw new CustomError(
      `Charge of ${charge} exceeds the documented actual cost of ${documentedCost}. ` +
        `A late fee may only compensate for evidenced loss, never for lost profit.`,
      400
    );
  }
  if (outstanding < SHARIA.riba.enforceBelowAmount && charge > 0) {
    throw new CustomError(
      `Outstanding balance of ${outstanding} is below the ${SHARIA.riba.enforceBelowAmount} ` +
        `threshold and must be written off rather than escalated to a charge.`,
      400
    );
  }
}

/**
 * The anti-gharar precondition: money may only be held once the sale is
 * sufficiently specified. Called before any escrow is created.
 *
 * This is the single most important guard in the file. It is what makes a
 * retainer defensible: the customer knew the service, the price, the duration
 * and the provider before paying.
 */
export function assertSaleIsSpecified(input: {
  serviceCount: number;
  price: number;
  durationMinutes: number;
  providerId: string | null;
  termsAcceptedAt: Date | null;
  surgeMultiplier?: number;
}): void {
  const missing: string[] = [];

  if (SHARIA.gharar.requireKnownProvider && !input.providerId) missing.push('provider');
  if (SHARIA.gharar.requirePricedService && input.serviceCount < 1) missing.push('service');
  if (SHARIA.gharar.requireKnownPrice && !(input.price > 0)) missing.push('price');
  if (SHARIA.gharar.requireKnownDuration && !(input.durationMinutes > 0)) missing.push('duration');
  if (SHARIA.gharar.requireTermsAccepted && !input.termsAcceptedAt) missing.push('accepted terms');
  if (
    SHARIA.gharar.requireNoSurgePricing &&
    input.surgeMultiplier !== undefined &&
    input.surgeMultiplier !== 1
  ) {
    missing.push('surge pricing (prohibited on a fixed-price service)');
  }

  if (missing.length) {
    throw new CustomError(
      `Cannot hold payment: the sale is not sufficiently specified (${missing.join(', ')}). ` +
        `Escrow requires a known service, price, duration, provider and accepted terms.`,
      400
    );
  }
}

/** Reject dynamic pricing on a booked service (maysir / najasy). */
export function assertNoSurgePricing(multiplier: number): void {
  if (SHARIA.maysir.dynamicServicePricingAllowed) return;
  if (multiplier !== 1) {
    throw new CustomError(
      'Peak-time pricing multipliers are not permitted on a fixed-price service.',
      400
    );
  }
}

/** The retainer amount actually chargeable given the cap and the agreed rate. */
export function permittedRetainer(price: number, requestedBps: number): number {
  const bps = Math.min(requestedBps, SHARIA.retainer.maxBps);
  return Math.round((price * bps) / BPS);
}

/**
 * Customer-facing disclosure. Shown before payment, not in a footer — terms
 * hidden until the payment step are the substance of a najasy complaint.
 */
export function shariaDisclosure(currency = 'PKR'): {
  title: string;
  points: string[];
} {
  return {
    title: 'Your payment is held safely, not lent',
    points: [
      `Held under safekeeping (amanah) by a licensed ${currency} payment partner. The platform does not lend it, price it, or earn a return from holding it.`,
      `Released to the provider only when the service is delivered, and returned to you in full if they cancel or cannot deliver.`,
      `A booking retainer is capped at ${SHARIA.retainer.maxBps / 100}% of the service price, and may only be kept against cost the provider can evidence.`,
      'No interest is charged on anything you owe, and no late fee is charged as a percentage of your balance.',
      `The service, price, duration and provider are fixed before you pay, and are not changed afterwards.`,
    ],
  };
}

/** Machine-readable compliance posture for the module/pulse surface. */
export function shariaPosture(): {
  escrowClassification: string;
  retainerCapBps: number;
  interestOnDebt: boolean;
  surgePricing: boolean;
  disclosureRequired: boolean;
} {
  return {
    escrowClassification: SHARIA.POSTURE.escrowClassification,
    retainerCapBps: SHARIA.retainer.maxBps,
    interestOnDebt: SHARIA.riba.interestOnDebtAllowed,
    surgePricing: SHARIA.maysir.dynamicServicePricingAllowed,
    disclosureRequired: SHARIA.najasy.termsVisibleBeforePayment,
  };
}
