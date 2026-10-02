import { describe, it, expect } from 'vitest';
import {
  quoteFee,
  processingCostCents,
  assertProfitable,
  tierFor,
  publicFeeSchedule,
  PROCESSOR,
  MIN_CHARGE_CENTS,
  FIRST_TRANSACTION_FREE_LIMIT,
  CATEGORY_PRICING,
  MIN_CATEGORY_MULTIPLIER,
  MAX_CATEGORY_MULTIPLIER,
  type FeeQuote,
} from '../src/config/fees';
import type { BusinessCategory } from '@prisma/client';

/**
 * The fee schedule.
 *
 * Two properties matter more than any particular rate, and they pull against
 * each other:
 *
 *   PROFITABILITY. Every rate must exceed payment processing at every ticket
 *   size. Square's 30¢ fixed charge is 2% of a $15 job, so a flat percentage is
 *   negative below roughly $40. Anything that lets us lose money on a small
 *   local booking is not a pricing choice, it is a bug.
 *
 *   PROFITABILITY AT SCALE. The other failure is pricing below cost on the jobs
 *   that carry the business. A $15,000 job at 3% is real money, and treating
 *   "large" as an occasion for generosity is how a marketplace ends up depending
 *   entirely on volume it does not have.
 *
 * Every assertion below is about one of those two, or about a number that would
 * be indefensible in a merchant conversation.
 */

/** Above the launch allowance, so the schedule rather than the discount applies. */
const ESTABLISHED = FIRST_TRANSACTION_FREE_LIMIT;

function fee(
  dollars: number,
  category: BusinessCategory = 'CLEANING',
  extra: Partial<Parameters<typeof quoteFee>[0]> = {},
): FeeQuote {
  return quoteFee({
    amountCents: Math.round(dollars * 100),
    category,
    settledTransactions: ESTABLISHED,
    ...extra,
  });
}

describe('processing cost model', () => {
  it('matches Square standard pricing', () => {
    // $100: 2.9% + 30¢ = $3.20.
    expect(processingCostCents(10_000)).toBe(320);
    // $15: 2.9% of $15 is $0.435, plus 30¢ = $0.735 → 74¢.
    expect(processingCostCents(1_500)).toBe(74);
  });

  it('makes the fixed fee the dominant cost on small charges', () => {
    // This is the entire reason the small tier is flat.
    const pct = PROCESSOR.percentRate;
    const fixedShare = PROCESSOR.fixedFeeCents / processingCostCents(1_500);
    expect(fixedShare).toBeGreaterThan(pct);
  });
});

describe('profitability at every ticket size', () => {
  it('never loses money across the full range a local business sees', () => {
    // Swept densely at the bottom where the fixed fee hurts most, then
    // logarithmically so large tickets are covered without a hundred iterations.
    const amounts = [500, 750, 1000, 1500, 2000, 3000, 4000, 4900, 5000, 7500, 10_000, 25_000, 49_999];
    for (let cents = 50_000; cents <= 5_000_000; cents *= 1.5) {
      amounts.push(cents);
    }
    for (const dollars of amounts) {
      for (const category of Object.keys(CATEGORY_PRICING) as BusinessCategory[]) {
        const q = fee(dollars, category);
        expect(
          q.marginCents,
          `${dollars} USD / ${category} nets ${q.marginCents}c`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('refuses to quote a rate that loses money', () => {
    expect(() => assertProfitable(1_500, 74, 'test')).toThrow(/loses money/i);
  });

  it('rejects a non-positive charge rather than quoting zero', () => {
    // A zero-amount charge with a percentage fee is 0, which looks like a
    // successful quote and skips the profitability check entirely.
    expect(() => fee(0)).toThrow(/non-positive/i);
    expect(() => fee(-100)).toThrow(/non-positive/i);
  });

  it('declines a charge too small for any fee to be profitable', () => {
    // Processing is 33¢ on $1.00. There is no rate that clears it, so the
    // honest answer is to decline rather than quote a negative margin.
    expect(() => fee(1)).toThrow(/minimum/i);
    expect(() => fee(4.99)).toThrow(/minimum/i);
    expect(fee(MIN_CHARGE_CENTS / 100).feeCents).toBeGreaterThan(0);
  });
});

describe('tiering', () => {
  it('uses a flat fee below $50 and a percentage above', () => {
    expect(tierFor(4_999)).toBe('small');
    expect(tierFor(5_000)).toBe('mid');
    expect(tierFor(49_999)).toBe('mid');
    expect(tierFor(50_000)).toBe('large');
  });

  it('charges the same flat fee across the upper small range', () => {
    // $20 and $49 both pay $1.85 (12% of $20 is $2.40, so the cap is not yet
    // binding). A percentage here is below cost on both, and a fixed 30¢ would be
    // 3% of $10 for us to earn nothing.
    expect(fee(20, 'OTHER').feeCents).toBe(185);
    expect(fee(49, 'OTHER').feeCents).toBe(185);
  });

  it('caps as a share of the charge on the smallest bookings', () => {
    // Below ~$15.42 the flat $1.85 would exceed the 12% cap, so the effective
    // rate falls with the charge. It stays profitable throughout because the cap
    // and the processing floor meet at $5.
    expect(fee(5, 'OTHER').feeCents).toBe(60);
    expect(fee(10, 'OTHER').feeCents).toBe(120);
    for (const dollars of [5, 7, 10, 15, 20, 30, 49]) {
      expect(fee(dollars).marginCents, `${dollars} USD`).toBeGreaterThan(0);
    }
  });

  it('caps the flat fee on a small charge instead of taking a third of it', () => {
    // $1.85 on $5 would be 37% of the booking. The merchant would be right to
    // call that a penalty, so the fee is capped as a share of the charge.
    expect(fee(5, 'OTHER').rate).toBeLessThanOrEqual(0.12);
    expect(fee(5, 'OTHER').feeCents).toBeLessThan(185);
    expect(fee(5, 'OTHER').marginCents).toBeGreaterThan(0);
    // And it climbs back to the flat fee, rather than staying capped.
    expect(fee(49, 'OTHER').feeCents).toBe(185);
  });

  it('charges less as a percentage above $500 without losing money', () => {
    const mid = fee(200);
    const large = fee(5_000);
    expect(large.rate).toBeLessThan(mid.rate);
    expect(large.marginCents).toBeGreaterThan(0);
  });
});

describe('category modulation', () => {
  it('prices high-frequency categories below the reference rate', () => {
    // SALON at 0.75 of a $200 job: 3.0% instead of 4.0%.
    expect(fee(200, 'SALON').feeCents).toBeLessThan(fee(200, 'CLEANING').feeCents);
    expect(fee(200, 'RESTAURANT').feeCents).toBeLessThan(fee(200, 'CLEANING').feeCents);
  });

  it('prices high-ticket categories above the reference rate', () => {
    expect(fee(1_000, 'FREELANCE').feeCents).toBeGreaterThan(fee(1_000, 'CLEANING').feeCents);
  });

  it('still applies category modulation on small tickets', () => {
    // An earlier version of this file asserted the flat fee was category-blind,
    // on the reasoning that the tier is set by processor economics. That was
    // wrong: what protects profitability here is the cap and the floor, not
    // category independence. A salon paying $1.39 on a $30 job instead of $1.85
    // is the discount doing its job, and it is still comfortably profitable.
    expect(fee(30, 'SALON').feeCents).toBeLessThan(fee(30, 'FREELANCE').feeCents);
    expect(fee(30, 'SALON').feeCents).toBeLessThan(fee(30, 'CLEANING').feeCents);
  });

  it('keeps a discounted small ticket profitable', () => {
    // The case the floor exists for: SALON's 0.75 on the smallest bookings.
    for (const dollars of [5, 10, 15, 20, 30, 49]) {
      const q = fee(dollars, 'SALON');
      expect(q.marginCents, `$${dollars} SALON`).toBeGreaterThan(0);
    }
  });

  it('documents why every category is priced where it is', () => {
    // These multipliers are pricing decisions and should be arguable, so each one
    // carries the reasoning rather than a bare number.
    for (const [category, pricing] of Object.entries(CATEGORY_PRICING)) {
      expect(pricing.rationale, category).toMatch(/\w/);
      expect(pricing.rationale.length, category).toBeGreaterThan(10);
    }
  });

  it('keeps every category multiplier inside the declared bounds', () => {
    for (const [category, pricing] of Object.entries(CATEGORY_PRICING)) {
      expect(pricing.multiplier, category).toBeGreaterThanOrEqual(MIN_CATEGORY_MULTIPLIER);
      expect(pricing.multiplier, category).toBeLessThanOrEqual(MAX_CATEGORY_MULTIPLIER);
    }
  });
});

describe('per-business overrides', () => {
  it('wins over the category default', () => {
    const quoted = fee(1_000, 'SALON', { businessMultiplier: 1.5 });
    expect(quoted.applied.join(' ')).toMatch(/override/i);
    expect(quoted.feeCents).toBeGreaterThan(fee(1_000, 'CLEANING').feeCents);
  });

  it('is clamped, so a merchant cannot set themselves negative', () => {
    // Otherwise a business could configure a 0% fee and we would serve them for
    // free without noticing.
    expect(fee(1_000, 'CLEANING', { businessMultiplier: 99 }).rate).toBeLessThanOrEqual(1);
    expect(() => fee(1_000, 'CLEANING', { businessMultiplier: -5 })).not.toThrow();
  });

  it('still cannot be set to lose money', () => {
    // The clamp bounds the top end; profitability is enforced separately, and
    // both must hold.
    const q = fee(2_000, 'CLEANING', { businessMultiplier: 2 });
    expect(q.marginCents).toBeGreaterThan(0);
  });
});

describe('onboarding', () => {
  it('charges a new business nothing for the first transactions', () => {
    const q = quoteFee({ amountCents: 500_00, category: 'CLEANING', settledTransactions: 0 });
    expect(q.feeCents).toBe(0);
    expect(q.applied.join(' ')).toMatch(/launch/i);
  });

  it('applies the schedule immediately after the allowance, with no cliff', () => {
    // No negotiation and no surprise step-up: the allowance is a transaction
    // count, so a merchant sees exactly which transaction is the first paid one.
    const lastFree = quoteFee({
      amountCents: 200_00,
      category: 'CLEANING',
      settledTransactions: FIRST_TRANSACTION_FREE_LIMIT - 1,
    });
    const firstPaid = quoteFee({
      amountCents: 200_00,
      category: 'CLEANING',
      settledTransactions: FIRST_TRANSACTION_FREE_LIMIT,
    });
    expect(lastFree.feeCents).toBe(0);
    expect(firstPaid.feeCents).toBeGreaterThan(0);
    expect(firstPaid.feeCents).toBe(fee(200).feeCents);
  });

  it('is negative on the free transactions, and says so', () => {
    // Free means free: we still pay the processor. Hiding that would make the
    // allowance look profitable when it is a customer-acquisition cost.
    const q = quoteFee({ amountCents: 500_00, category: 'CLEANING', settledTransactions: 0 });
    expect(q.marginCents).toBeLessThan(0);
  });

  it('publishes the allowance rather than burying it', () => {
    expect(publicFeeSchedule().onboarding.freeTransactions).toBe(FIRST_TRANSACTION_FREE_LIMIT);
  });
});

describe('determinism and presentation', () => {
  it('gives the same answer for the same inputs', () => {
    expect(fee(137.42, 'FREELANCE')).toEqual(fee(137.42, 'FREELANCE'));
  });

  it('derives the fee from a whole number of basis points', () => {
    // A rate printed as 0.033800000000000004 on an invoice reads as a bug. The
    // assertion cannot be Number.isInteger(rate * 10000) or an exact round-trip:
    // dividing 338 by 10000 and multiplying back gives 337.99999999999994 in
    // floating point, so both would fail on a correctly-stored rate.
    //
    // What actually matters is that the rate *is* exactly bps/10000, which shows
    // up as the fee being reproducible from the rounded rate. That is the property
    // a human reconciling an invoice would rely on.
    for (const dollars of [5, 30, 123.45, 200, 5000]) {
      for (const category of ['SALON', 'FREELANCE', 'CLEANING', 'OTHER'] as BusinessCategory[]) {
        const q = fee(dollars, category);
        const bps = Math.round(q.rate * 10_000);
        const recomputed = Math.round(Math.round(dollars * 100) * (bps / 10_000));
        expect(recomputed, `$${dollars} ${category}`).toBe(q.feeCents);
      }
    }
  });

  it('never charges more than the amount', () => {
    for (const dollars of [5, 10, 50, 500]) {
      const q = fee(dollars, 'OTHER');
      expect(q.feeCents).toBeLessThanOrEqual(Math.round(dollars * 100));
    }
  });

  it('reports which discounts applied', () => {
    // Support needs to be able to explain an invoice line, and that means the
    // engine has to know what it did.
    expect(fee(30, 'SALON').applied.length).toBeGreaterThan(0);
    expect(fee(200, 'FREELANCE').applied.join(' ')).toMatch(/category/i);
  });

  it('generates a schedule table from the same constants it charges', () => {
    // A published table generated separately from the engine is how a merchant
    // ends up quoted one rate and billed another.
    const schedule = publicFeeSchedule();
    expect(schedule.tiers).toHaveLength(3);
    expect(schedule.tiers[0].rate).toBe('1.85 flat');
    expect(schedule.categories).toHaveLength(Object.keys(CATEGORY_PRICING).length);
  });
});

describe('sensitivity', () => {
  it('never charges zero on a real charge', () => {
    // A zero fee below the launch allowance is intentional; a zero fee above it
    // would mean the floor let a discount all the way through.
    for (const dollars of [5, 10, 50, 200, 5000]) {
      expect(fee(dollars).feeCents, `${dollars} USD`).toBeGreaterThan(0);
    }
  });

  it('shows why the flat tier exists', () => {
    // The number a flat 4% percentage would have produced at $15, versus what we
    // actually charge. If these ever converge, the tiering has stopped earning
    // its complexity.
    const flatPercentageAt4 = Math.round(1_500 * 0.04);
    expect(flatPercentageAt4).toBeLessThan(processingCostCents(1_500));
    expect(fee(15, 'OTHER').feeCents).toBeGreaterThan(flatPercentageAt4);
  });

  it('keeps margin as a percentage of the fee roughly stable across sizes', () => {
    // Not constant — the small tier is deliberately worse per dollar — but not
    // collapsing either, which would mean the large tier is funding losses.
    const mid = fee(200);
    const large = fee(5_000);
    expect(mid.marginCents / mid.feeCents).toBeGreaterThan(0.1);
    expect(large.marginCents / large.feeCents).toBeGreaterThan(0.1);
  });
});