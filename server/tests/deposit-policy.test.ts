import { describe, it, expect } from 'vitest';
import {
  applyBand,
  bandForScore,
  bandExplanation,
  multiplierForBand,
  quoteWithoutHistory,
  type TrustBand,
} from '../src/services/deposit-policy.rules';

/**
 * Trust-band deposits.
 *
 * Two properties are under test and they pull in opposite directions:
 *
 *   - A good record must buy a materially lower deposit, or the score is
 *     decorative and nobody accumulates it.
 *   - The business must keep control of the amount. The band scales the
 *     business's own number; it must never invent one, and a band-A customer
 *     paying nothing must not look like the business charges nothing.
 *
 * The transparency requirement is the reason every quote carries baseAmount,
 * multiplier and standardAmount rather than just the final number: a customer
 * shown $0 needs to be able to see it came from their history, not from the
 * salon's prices.
 */

describe('bandForScore', () => {
  it('places a new passport in C, paying the standard amount', () => {
    // New passports default to 500. Band A pays no deposit, so defaulting there
    // would hand the top tier to everyone on day one with no history to justify
    // it, and the score would stop meaning anything. 500 lands in C rather than B
    // deliberately: a customer with no history should pay exactly what the
    // business asked for, and B would already be a discount for existing
    // customers only.
    expect(bandForScore(500)).toBe('C');
  });

  it('maps the 0-1000 range to ordered bands', () => {
    expect(bandForScore(1000)).toBe('A');
    expect(bandForScore(800)).toBe('A');
    expect(bandForScore(799)).toBe('B');
    expect(bandForScore(600)).toBe('B');
    expect(bandForScore(599)).toBe('C');
    expect(bandForScore(400)).toBe('C');
    expect(bandForScore(399)).toBe('D');
    expect(bandForScore(0)).toBe('D');
  });

  it('treats a non-numeric score as neutral rather than worst', () => {
    // Absence of data is not evidence of badness.
    expect(bandForScore(NaN)).toBe('C');
    expect(bandForScore(undefined as unknown as number)).toBe('C');
  });
});

describe('band multipliers', () => {
  it('reduces the deposit for a good record and increases it for a poor one', () => {
    expect(multiplierForBand('A')).toBeLessThan(multiplierForBand('B'));
    expect(multiplierForBand('B')).toBeLessThan(multiplierForBand('C'));
    expect(multiplierForBand('C')).toBeLessThan(multiplierForBand('D'));
  });

  it('caps the penalty so a business cannot lean on the band to punish', () => {
    // The band is a statement about the customer. If it could double the ask,
    // the platform would be setting the price on the business's behalf by
    // another route.
    expect(multiplierForBand('D')).toBeLessThanOrEqual(1.25);
  });

  it('never charges less than zero', () => {
    // The band A waiver has to floor at zero rather than go negative, which is
    // what makes "no deposit" expressible at all.
    for (const band of ['A', 'B', 'C', 'D'] as TrustBand[]) {
      expect(applyBand(100, band, 700).amount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('applyBand', () => {
  it('waives the deposit for an A-band customer', () => {
    const q = applyBand(80, 'A', 900);
    expect(q.amount).toBe(0);
    expect(q.baseAmount).toBe(80);
    expect(q.standardAmount).toBe(80);
    expect(q.adjusted).toBe(true);
  });

  it('halves it for a B-band customer', () => {
    expect(applyBand(80, 'B', 700).amount).toBe(40);
  });

  it('charges the standard amount for a C-band customer', () => {
    const q = applyBand(80, 'C', 500);
    expect(q.amount).toBe(80);
    expect(q.adjusted).toBe(false);
  });

  it('applies the capped uplift for a D-band customer', () => {
    expect(applyBand(80, 'D', 200).amount).toBe(100);
  });

  it('always exposes the base and the standard amount alongside the result', () => {
    // This is the transparency contract. A customer shown $0 must be able to see
    // what the business normally charges.
    const q = applyBand(80, 'A', 900);
    expect(q.baseAmount).toBe(80);
    expect(q.standardAmount).toBe(80);
    expect(q.multiplier).toBe(0);
    expect(q.band).toBe('A');
    expect(q.score).toBe(900);
  });

  it('rounds to cents so an invoice never shows a float artefact', () => {
    expect(applyBand(33.333, 'B', 700).amount).toBe(16.67);
    expect(applyBand(0.07, 'B', 700).amount).toBe(0.04);
  });

  it('yields nothing for a business with no deposit policy', () => {
    for (const base of [0, -5, NaN]) {
      expect(applyBand(base, 'C', 500).amount).toBe(0);
    }
  });

  it('gives the same answer for the same inputs', () => {
    // Reproducibility is what makes "the salon charges me less than my friend"
    // checkable rather than a complaint.
    expect(applyBand(64, 'B', 712)).toEqual(applyBand(64, 'B', 712));
  });
});

describe('customers with no history', () => {
  it('charges the standard amount, not the penalty', () => {
    // Absence of a passport means we know nothing, and treating that as bad
    // would penalise every first-time customer.
    const q = quoteWithoutHistory(80);
    expect(q.amount).toBe(80);
    expect(q.band).toBeNull();
    expect(q.adjusted).toBe(false);
  });

  it('tells the customer the deposit drops as their history grows', () => {
    // Otherwise a first-timer has no reason to build a record, which is the
    // mechanism that makes bands work.
    expect(quoteWithoutHistory(80).explanation).toMatch(/history/i);
  });
});

describe('explanations', () => {
  it('states the reason for every band', () => {
    for (const band of ['A', 'B', 'C', 'D'] as TrustBand[]) {
      const text = bandExplanation(band);
      expect(text.length).toBeGreaterThan(20);
      expect(text).toMatch(/deposit|slot/i);
    }
  });

  it('attributes a reduction to the customer, never to the price', () => {
    // The failure mode this prevents: a zero deposit being read as a cheap
    // business rather than an earned discount.
    expect(bandExplanation('A')).toMatch(/booking history|no deposit/i);
    expect(bandExplanation('A')).not.toMatch(/discount|special offer|cheaper/i);
  });

  it('does not imply a penalty is a judgement of worth', () => {
    // D is described in terms of the record being built, not the customer being
    // untrustworthy, so a reduced score does not read as an accusation.
    expect(bandExplanation('D')).toMatch(/history/i);
    expect(bandExplanation('D')).not.toMatch(/untrustworthy|fraud|risk/i);
  });
});