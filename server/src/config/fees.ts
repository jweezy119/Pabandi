/**
 * Pabandi fee schedule — the single source of truth for what we CHARGE.
 *
 * SCOPE, WHICH IS NARROWER THAN IT LOOKS
 * This file is for platform take rates and our processor cost. It is deliberately
 * NOT the home of every number with a percentage in it. An audit found roughly 50
 * such constants and classified them: only 7 are actually a take. The rest are
 *
 *   REWARDS   PAB_REWARD_RATE and friends — money we pay OUT to agents and
 *             customers for showing up. 5% is not a 5% fee; folding it in here
 *             would make it look like revenue and would eventually be quoted as
 *             one.
 *   STAKING   AUTO_STAKE_RATE, SLASH_RATES, STAKE_TIERS — token mechanics with
 *             their own accounting, and a slashing rate is emphatically not a fee.
 *   GAS       SOL_FEE_PER_BOOKING, SOL_BUFFER — denominated in SOL, not USD, and
 *             they pay a validator rather than us.
 *   SIMULATION compounding's 15%, profitEngine's rate — projections that move no
 *             money. compounding.service.ts documents this itself.
 *   TOLERANCE AMOUNT_TOLERANCE in reconciliation — a matching window.
 *
 * Putting any of those in a fee engine would be actively harmful: it would make
 * the engine's arithmetic and its reporting lie. They are collected here as
 * documentation of that decision, not migrated.
 *
 * What this file does replace: six different rates for the same booking. A
 * merchant billed 5% while their neighbour was billed 3% is not a rounding
 * difference, it is a reason to leave, and it is unanswerable because no two code
 * paths agreed on what the fee was.
 *
 * ── What this fee pays for ─────────────────────────────────────────────────
 *
 * The customer pays exactly the quoted price. There is no markup on what they
 * see, and that is the product: a marketplace that adds 5% to a visible quote
 * loses to one that charges the business and keeps the customer's number honest.
 * So every rule here is about the *merchant's* side.
 *
 * What the merchant is paying for, in the order they will notice it:
 *
 *   - Demand. The reason any of this is worth paying for.
 *   - Payment rails they would otherwise have to set up per business.
 *   - Deposit protection and the evidence trail behind it.
 *   - Dispute handling that neither party has to run themselves.
 *
 * ── The constraint everything else follows from ───────────────────────────
 *
 * The fee must exceed payment processing at every ticket size, or we lose money
 * on exactly the local services this marketplace exists for.
 *
 * Square's standard rate is 2.9% + 30¢. That fixed 30¢ is 2.0% of a $15 job and
 * 0.6% of a $50 one, so a flat percentage cannot work across job sizes — at 4%
 * it is *negative* below roughly $40. That arithmetic, not preference, is why
 * small tickets are a flat fee and large tickets are a percentage. See
 * `MIN_MARGIN_CENTS` and `assertProfitable` below, which enforce it in code
 * rather than in a spreadsheet someone has to remember to open.
 *
 * ── Why categories modulate ───────────────────────────────────────────────
 *
 * A $40 salon appointment and a $4,000 freelance contract have different
 * characteristics: the appointment is high-frequency and price-sensitive with
 * thin absolute margins; the contract is rare and has room to absorb a fee.
 * A single rate has to be wrong for one of them.
 *
 * This is a *pricing* decision, not a payments one, so it should be visible and
 * arguable. Every multiplier is named, commented with why, and modifiable per
 * business.
 */

import type { BusinessCategory } from '@prisma/client';

// ── Processing cost model ──────────────────────────────────────────────────
//
// Mirrors Square US standard pricing. Held here rather than read from a config
// so the margin arithmetic in this file is checkable in one place. If the
// processor changes its rates, this is the block to update — and the change is
// deliberately noisy, because a processor rate change moves every merchant's
// margin and should not pass unnoticed.
export const PROCESSOR = {
  /** Square Payments standard rate, as a fraction. */
  percentRate: 0.029,
  /** Square's fixed per-transaction charge, in dollars. */
  fixedFeeCents: 30,
} as const;

/** What processing costs us, in cents, for a charge of `amountCents`. */
export function processingCostCents(amountCents: number): number {
  return Math.round(amountCents * PROCESSOR.percentRate + PROCESSOR.fixedFeeCents);
}

/**
 * The margin below which we refuse to schedule a rate.
 *
 * Two cents, not zero. A rate that nets exactly nothing survives one
 * disagreement, one chargeback, one currency-conversion rounding error — and
 * processing fees are charged per transaction against a ledger we do not
 * control.
 */
export const MIN_MARGIN_CENTS = 2;

/**
 * Refuse a rate that loses money.
 *
 * Called by every pricing path so an unprofitable configuration fails loudly at
 * the point it is defined rather than quietly on a merchant's invoice.
 */
export function assertProfitable(amountCents: number, feeCents: number, context: string): void {
  const margin = feeCents - processingCostCents(amountCents);
  if (margin < MIN_MARGIN_CENTS) {
    throw new Error(
      `[Fees] ${context}: fee ${feeCents}c loses money on a ${amountCents}c charge ` +
        `(processing ${processingCostCents(amountCents)}c, margin ${margin}c, minimum ${MIN_MARGIN_CENTS}c).`,
    );
  }
}

// ── Ticket tiers ──────────────────────────────────────────────────────────
//
// The flat tier exists solely because of the 30¢ fixed fee. It is not a
// promotional rate and not a discount — it is the smallest number that does not
// lose money on a small charge.

/**
 * Smallest charge we will take payment for.
 *
 * Processing is a flat 30¢ plus 2.9%, so at $1.00 it costs 33¢. Set at $5.00 for
 * two reasons that happen to agree: no fee is profitable below roughly $3.50, and
 * below $5 the capped rate would still leave a margin of pennies on the smallest
 * bookings — which is work for everyone and money for nobody.
 *
 * This is a minimum *booking value*, not a minimum fee, and it should be
 * published. Declining is the honest response; quoting a negative-margin rate and
 * hoping volume covers it is how a marketplace ends up subsidising its own
 * smallest customers.
 */
export const MIN_CHARGE_CENTS = 500; // $5.00

/** Below this, a percentage fee cannot cover the fixed processing charge. */
export const FLAT_FEE_THRESHOLD_CENTS = 5_000; // $50

/**
 * Flat fee for small charges.
 *
 * Sized against the *top* of the small band, not the bottom, because that is
 * where the fixed 30¢ bites hardest: at $49 processing is 172¢, so anything
 * below ~180¢ loses money somewhere in this tier. $1.85 leaves a few cents at
 * $49 and is comfortably clear at $10, where processing is only 59¢.
 *
 * Set by that constraint, not chosen for how it looks on a price list. The
 * reason it does not read as punitive is MAX_SMALL_TICKET_RATE below.
 */
export const SMALL_TICKET_FEE_CENTS = 185;

/**
 * Cap on the small-ticket fee as a share of the charge.
 *
 * Without this, a flat $1.85 on a $5 booking is 37% of the take, and a merchant
 * would be right to call that a penalty. Capping it at 12% keeps the flat fee
 * honest on normal bookings while not letting it become ruinous on trivial ones.
 *
 * The cap is safe: at the smallest charge where it binds ($15, 12% = 180¢)
 * processing is 74¢, so margin stays positive.
 */
export const MAX_SMALL_TICKET_RATE = 0.12;

/**
 * Percentage for mid-range charges.
 *
 * 4.5% rather than the 4% that reads better. At $50 processing is 175¢ and 4%
 * collects 200¢ — a 25¢ margin on the merchant's entire booking, which is not a
 * business. 4.5% triples that. The floor in `minimumViableRate` would have
 * corrected the worst of it anyway; this is choosing the number deliberately
 * rather than being rescued by a guard rail.
 */
export const MID_TICKET_RATE = 0.045;

/**
 * Percentage for large charges.
 *
 * Lower than mid-range because our cost is a percentage too: at $5,000
 * processing is 2.91%, so the extra half-point on mid is margin rather than
 * necessity. But not much lower — an earlier 3% here netted 20¢ on a $1,480
 * charge, which is 1.3% of the fee and no business at all. 3.5% keeps roughly
 * 17% of the fee as margin.
 */
export const LARGE_TICKET_THRESHOLD_CENTS = 50_000; // $500
export const LARGE_TICKET_RATE = 0.035;

// ── Category modulation ────────────────────────────────────────────────────
//
// Multipliers on the *rate*, not on the fee. Applied after the tier is chosen,
// so a small salon booking still uses the flat fee — these shape the
// percentage, which is the only part that scales with value.
//
// Direction of each multiplier is a deliberate claim about who can absorb a fee.

export interface CategoryPricing {
  multiplier: number;
  /** Why this category is treated differently. Shown to whoever edits this. */
  rationale: string;
}

export const CATEGORY_PRICING: Record<BusinessCategory, CategoryPricing> = {
  // High-frequency, low-ticket, and the customer is comparing three salons in a
  // browser. A fee the merchant cannot pass on comes straight out of a thin
  // margin, so these are priced to be easy to say yes to.
  SALON: {
    multiplier: 0.75,
    rationale: 'High-frequency, low-ticket, price-competitive. Prioritise adoption.',
  },
  SPA: { multiplier: 0.75, rationale: 'Same economics as salon: frequent and price-visible.' },
  RESTAURANT: { multiplier: 0.75, rationale: 'Frequent repeat visits; discount drives loyalty.' },
  FITNESS_CENTER: {
    multiplier: 0.75,
    rationale: 'Membership economics reward a low headline fee.',
  },

  // Genuine services businesses, mid-ticket, moderate frequency.
  CLEANING: {
    multiplier: 1.0,
    rationale: 'Reference category. Recurring work with room to absorb a standard rate.',
  },
  CLINIC: {
    multiplier: 1.0,
    rationale: 'Reference category.',
  },

  // Larger, rarer, higher-value engagements where a percentage is a rounding
  // error against the work. These can carry more.
  FREELANCE: {
    multiplier: 1.25,
    rationale: 'High-ticket, infrequent. A percentage is immaterial to contract value.',
  },
  PROPERTY_RENTAL: {
    multiplier: 1.25,
    rationale: 'High-value transactions, low volume.',
  },
  ECOMMERCE: {
    multiplier: 1.25,
    rationale: 'High transaction value; fee is small relative to GMV.',
  },

  // Not really local services — priced neutrally rather than tuned, since we
  // have no evidence about how these behave on Pabandi.
  EVENT_VENUE: { multiplier: 1.0, rationale: 'Neutral pending data.' },
  HOTEL: { multiplier: 1.0, rationale: 'Neutral pending data.' },
  HOSPITAL: { multiplier: 1.0, rationale: 'Neutral pending data.' },
  LIVE_SELLER: { multiplier: 1.0, rationale: 'Neutral pending data.' },
  MARKETPLACE: {
    multiplier: 1.0,
    rationale: 'Neutral pending data. Deliberately not tuned — a marketplace on a marketplace is unmodelled.',
  },
  OTHER: { multiplier: 1.0, rationale: 'Default. No category-specific assumption made.' },
};

/** Absolute multiplier bounds. Category tuning may not exceed these. */
export const MIN_CATEGORY_MULTIPLIER = 0.5;
export const MAX_CATEGORY_MULTIPLIER = 2.0;

// ── Onboarding ─────────────────────────────────────────────────────────────

/**
 * Launch rate for businesses with no completed transactions yet.
 *
 * We have no merchants. The first few dozen are worth more as reference and
 * word-of-mouth than as margin, and a marketplace that charges from day one has
 * to be worth its fee before anyone has experienced what it does.
 *
 * Bounded on both sides, because "free for new users" that never ends is not an
 * onboarding discount, it is no pricing at all:
 *   - 0% fee, so a new merchant pays nothing while they evaluate us.
 *   - Only until FIRST_TRANSACTION_FREE_LIMIT transactions, after which the
 *     standard schedule applies with no negotiation and no cliff-edge surprise.
 *
 * Expressed as a transaction count rather than a calendar window on purpose: a
 * discount should expire when the merchant has got what it was for.
 */
export const FIRST_TRANSACTION_FREE_LIMIT = 10;
export const LAUNCH_RATE_MULTIPLIER = 0;

// ── The schedule ──────────────────────────────────────────────────────────

export type FeeTier = 'small' | 'mid' | 'large';

export interface FeeInputs {
  /** Charge amount in cents. */
  amountCents: number;
  category: BusinessCategory;
  /** Completed transactions this business has settled. */
  settledTransactions?: number;
  /** Per-business multiplier override. Wins over the category default. */
  businessMultiplier?: number | null;
}

export interface FeeQuote {
  /** The rate that applies, after tier, category and launch discount. */
  rate: number;
  /** What the merchant pays, in cents. Never negative. */
  feeCents: number;
  /** What we keep after payment processing, in cents. */
  marginCents: number;
  tier: FeeTier;
  category: BusinessCategory;
  /** Which discounts applied, for the invoice line and for support. */
  applied: string[];
  currency: string;
}

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_CATEGORY_MULTIPLIER, Math.max(MIN_CATEGORY_MULTIPLIER, value));
}

/**
 * Quote the fee for one charge.
 *
 * Deliberately a pure function of its inputs plus a transaction count. The count
 * is passed in rather than read from the database so this is testable and so the
 * caller is explicit about whose history is being used — a function that reads
 * the caller silently is a function that will one day read the wrong one.
 */
export function quoteFee(inputs: FeeInputs, currency = 'USD'): FeeQuote {
  const { amountCents, category } = inputs;

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error(`[Fees] Cannot price a non-positive charge: ${amountCents}c`);
  }

  if (amountCents < MIN_CHARGE_CENTS) {
    // Below this, no fee is profitable at any rate: processing is 33¢ on a $1
    // charge, so a capped percentage cannot cover it. The honest answer is to
    // decline rather than to quote something that loses money — this is a
    // minimum booking value, not a minimum fee, and it should be published.
    throw new Error(
      `[Fees] Charge of ${amountCents}c is below the ${MIN_CHARGE_CENTS}c minimum. ` +
        `Processing costs ${processingCostCents(amountCents)}c, so no fee is profitable.`,
    );
  }

  const applied: string[] = [];

  // Rates are carried as integer basis points throughout. Doing the arithmetic in
  // floating point and rounding at the end looks equivalent and is not: a rate
  // of 0.0338 multiplied back out and re-rounded lands on 338.00000000000006,
  // which fails any "is this a whole number of basis points" check and prints as
  // 0.033800000000000006 on an invoice line. Working in integers and dividing
  // once at the end avoids the whole class of it.
  const toBps = (rate: number): number => Math.round(rate * 10_000);
  const fromBps = (bps: number): number => bps / 10_000;

  // 1. Launch discount — a new merchant pays nothing, so there is no point
  //    calculating anything else on their behalf.
  if ((inputs.settledTransactions ?? 0) < FIRST_TRANSACTION_FREE_LIMIT) {
    return {
      rate: 0,
      feeCents: 0,
      marginCents: -processingCostCents(amountCents),
      tier: tierFor(amountCents),
      category,
      applied: [`launch: ${FIRST_TRANSACTION_FREE_LIMIT} transactions free`],
      currency,
    };
  }

  // 2. Tier by ticket size — the flat tier is forced by processor economics.
  const tier = tierFor(amountCents);
  let feeCents: number;
  let bps: number;

  if (tier === 'small') {
    // Flat, but capped as a share of the charge so a small booking is not
    // charged a punitive fraction of itself. Then floored like every other tier,
    // which matters here: at $5 the cap binds at 12% (60¢) while processing is
    // 45¢, and a merchant on a category discount would otherwise push under it.
    bps = Math.min(toBps(SMALL_TICKET_FEE_CENTS / amountCents), toBps(MAX_SMALL_TICKET_RATE));
    applied.push(`small-ticket: flat ${(SMALL_TICKET_FEE_CENTS / 100).toFixed(2)}`);
  } else {
    bps = toBps(tier === 'mid' ? MID_TICKET_RATE : LARGE_TICKET_RATE);
    if (tier === 'large') applied.push('large-ticket: reduced rate');
  }

  // 3. Category modulation, per-business override winning over the default.
  const override = inputs.businessMultiplier;
  const categoryMultiplier = CATEGORY_PRICING[category]?.multiplier ?? 1;
  const multiplier = clampMultiplier(
    override != null && Number.isFinite(override) ? override : categoryMultiplier,
  );
  if (multiplier !== 1) {
    applied.push(`category:${category} ×${multiplier}`);
  }
  if (override != null && override !== categoryMultiplier) {
    applied.push('per-business override');
  }

  // 4. Apply the category discount, then floor it at the minimum viable rate.
  //    Order matters: modulating first and flooring second means the discount is
  //    honoured wherever it is affordable and quietly surrendered only where it
  //    would cost us money. Flooring first would throw away the discount entirely.
  //
  //    Rounding is always up, never to nearest, on both the discount and the
  //    floor. Nearest rounding can land a basis point below the floor and then the
  //    guarantee this file exists to make is false by a rounding error.
  const discountedBps = Math.ceil(toBps(fromBps(bps) * multiplier));
  // The floor is computed from *rounded cents*, not from a fractional rate.
  //
  // Deriving it from the real-valued rate and rounding afterwards loses the
  // cent: a required 2.964% rounds to 2.96% = $14.80 on a $500 charge, which is
  // exactly the $14.80 of processing, so the margin is zero rather than the 2¢
  // promised. Rounding the required *cents* up first and dividing by the charge
  // can only ever overshoot, which is the safe direction.
  const requiredCents = processingCostCents(amountCents) + MIN_MARGIN_CENTS;
  const floorBps = Math.ceil((requiredCents / amountCents) * 10_000);

  if (discountedBps < floorBps) {
    applied.push(`floored to ${fromBps(floorBps) * 100}% (processing cost)`);
    bps = floorBps;
  } else {
    bps = discountedBps;
  }

  // A fee can never exceed the charge, and never exceeds 100%.
  bps = Math.min(bps, toBps(1));
  const rate = fromBps(bps);
  feeCents = Math.round(amountCents * rate);

  const marginCents = feeCents - processingCostCents(amountCents);

  assertProfitable(amountCents, feeCents, `${tier}/${category}`);

  return { rate, feeCents, marginCents, tier, category, applied, currency };
}

export function tierFor(amountCents: number): FeeTier {
  if (amountCents < FLAT_FEE_THRESHOLD_CENTS) return 'small';
  if (amountCents < LARGE_TICKET_THRESHOLD_CENTS) return 'mid';
  return 'large';
}

/**
 * The lowest rate that still clears processing plus the minimum margin.
 *
 * This is the floor every pricing path is measured against, and it exists because
 * category modulation is a multiplicative discount on top of a rate that was
 * already thin. A 25% discount on a 3% rate lands below the cost of taking the
 * money, which is how a "popular categories pay less" policy quietly becomes a
 * loss leader.
 *
 * Rather than constraining the multipliers until none of them can overlap the
 * loss region — which couples every category's price to every ticket size — the
 * discount is allowed and then floored. A category that needs a discount on a
 * $50 job gets it; one that would need a discount to be viable on a $50 job is
 * telling us the base rate is wrong, and the log says so.
 */
export function minimumViableRate(amountCents: number): number {
  const requiredCents = processingCostCents(amountCents) + MIN_MARGIN_CENTS;
  return requiredCents / amountCents;
}

/**
 * The whole schedule as a table, for the page a merchant reads before signing up.
 *
 * A merchant who has to email support to find out what they will be charged will
 * assume the worst. The table is generated from the same constants the engine
 * uses so it cannot drift from what they are actually billed.
 */
export function publicFeeSchedule(): {
  tiers: Array<{ label: string; range: string; rate: string }>;
  categories: Array<{ category: BusinessCategory; multiplier: number; rationale: string }>;
  onboarding: { freeTransactions: number };
} {
  return {
    tiers: [
      {
        label: 'Small bookings',
        range: `under ${(FLAT_FEE_THRESHOLD_CENTS / 100).toFixed(0)}`,
        rate: `${(SMALL_TICKET_FEE_CENTS / 100).toFixed(2)} flat`,
      },
      {
        label: 'Standard',
        range: `${(FLAT_FEE_THRESHOLD_CENTS / 100).toFixed(0)} – ${(LARGE_TICKET_THRESHOLD_CENTS / 100).toFixed(0)}`,
        rate: `${(MID_TICKET_RATE * 100).toFixed(1)}%`,
      },
      {
        label: 'Large jobs',
        range: `over ${(LARGE_TICKET_THRESHOLD_CENTS / 100).toFixed(0)}`,
        rate: `${(LARGE_TICKET_RATE * 100).toFixed(1)}%`,
      },
    ],
    categories: Object.entries(CATEGORY_PRICING).map(([category, pricing]) => ({
      category: category as BusinessCategory,
      multiplier: pricing.multiplier,
      rationale: pricing.rationale,
    })),
    onboarding: { freeTransactions: FIRST_TRANSACTION_FREE_LIMIT },
  };
}

// ── Agent and API layer ────────────────────────────────────────────────────
//
// A different schedule from the merchant fee above, and deliberately separate
// rather than sharing CATEGORY_PRICING. These are flat per-unit prices for
// machine callers, so the tiering-by-ticket-size logic does not apply — there is
// no "small job" about a metered API call.
//
// Kept here because they are still prices we charge, and the failure mode of them
// drifting apart is the same as any other fee constant: two documents quoting
// different numbers for the same thing.
//
// X402_PRICING values match section 11.5 of the whitepaper. They were inline in
// x402.service.ts and are now the definition rather than a copy.
export const X402_PRICING = {
  /** Per Trust API call. */
  TRUST_API_CALL: 0.01,
  /** Per escrow initiated, as a fraction of the escrowed amount. */
  ESCROW_INITIATION: 0.005,
  PREMIUM_PASSPORT: 0.05,
  MCP_TOOL_CALL: 0.001,
} as const;

/**
 * Agent-layer take rates.
 *
 * These apply to agent-to-agent commerce, which is a different market from local
 * services and has its own pricing. `AGENT_ECONOMY_RAKE` is a 10% rake on a human
 * rake — it is not a second layer on top of one; it is the only fee on that path.
 * `AGENT_MARKETPLACE_FEE` is the 2% on agent escrow.
 *
 * The two coexist because they price different transactions: one is taken when an
 * agent pays a rake, the other when an agent's escrow settles. That distinction
 * was invisible while both were literals named similarly in different files.
 */
export const AGENT_ECONOMY_RAKE = 0.10;
export const AGENT_MARKETPLACE_FEE = 0.02;

/** Offramp conversion fee, as a fraction. Quoted to the user before they convert. */
export const OFFRAMP_FEE_RATE = 0.015;

/**
 * Published processor rates, for reporting only. Never charged.
 *
 * These are what Square, PayPal, SafePay and Solana COST us per rail. They appear
 * in money-flow reporting so a margin question can be answered, and they are the
 * same numbers PROCESSOR models for the merchant fee's profitability floor. They
 * are not a schedule anyone is billed.
 */
export const PUBLISHED_RAIL_FEES: Record<string, { bps: number; label: string; note: string }> = {
  square: { bps: 290, label: 'Square', note: '2.9% + $0.30 per transaction' },
  paypal: { bps: 290, label: 'PayPal', note: '2.9% + fixed fee, varies by tier' },
  safepay: { bps: 250, label: 'SafePay', note: '2.5% local card processing' },
  solana: { bps: 25, label: 'Solana USDC', note: '~$0.25 network fee per transfer' },
  bank: { bps: 0, label: 'Bank transfer', note: 'No processing fee' },
};

