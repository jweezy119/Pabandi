import { describe, it, expect } from 'vitest';
import type { BusinessPaymentMethod } from '@prisma/client';

import {
  selectRail,
  COST_TIEBREAK_BAND,
  type RailClient,
  type RailInvoice,
} from '../rail-router.service';
import {
  RAIL_COSTS,
  FLAT_FEE_RAILS,
  estimateRailCost,
  settlementDecision,
  finalityFor,
  type Rail,
} from '../../config/rail-cost';
import {
  canHandle,
  fallbackChainFor,
  walkFallbackChain,
  classifyFailure,
  shouldRetrySameRail,
  MAX_RETRIES,
  SOLANA_RETRY_PRIORITY_MULTIPLIER,
  RAIL_FALLBACK,
  type EligibilityContext,
} from '../../config/rail-fallback';
import { PUBLISHED_RAIL_FEES } from '../../config/fees';

/**
 * Rail routing: cost, fallback, crypto eligibility and settlement finality.
 *
 * ─── WHY THESE ARE PURE ─────────────────────────────────────────────────────
 * Every function under test here is Prisma-free by construction. That is a
 * deliberate property of the design, not a convenience: routing policy is a
 * question about what should happen, and it should be answerable without a
 * database. The parts that do touch the database — the retry orchestration,
 * the reconciliation claim — live in `payment-retry.service.ts` and are
 * exercised through their pure decision helpers here rather than through mocks
 * that would only prove the mocks are consistent with themselves.
 */

/**
 * A real Solana address. Used wherever a client needs a wallet, because
 * `canHandle` validates the base58 shape rather than merely checking the field
 * is present — a non-empty string is not the same as a usable wallet, and the
 * tests should not be able to tell the difference.
 */
const WALLET = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';

/** Square's registered-target validator only accepts these hosts. */
const SQUARE_LINK = 'https://square.link/p/abc123';
const PAYPAL_LINK = 'https://paypal.me/someone';
const SAFEPAY_LINK = 'https://checkout.safepay.com.pk/pay/abc123';

function method(railId: string, target: string, isDefault = false): BusinessPaymentMethod {
  // Cast once, at the single point where a test fixture is shaped. A full row
  // carries timestamps and ids that no routing decision reads, and inventing
  // them per test would bury the two fields that matter (railId and target).
  return { railId, target, isDefault, displayName: railId } as unknown as BusinessPaymentMethod;
}

function invoice(subtotal: number, currency = 'USD'): RailInvoice {
  return { id: 'inv_1', number: 'INV-0001', subtotal, clientId: 'cli_1', businessId: 'biz_1' };
}

function client(address: string | null, email: string | null = 'payer@example.com'): RailClient {
  return { id: 'cli_1', name: 'Payer', email, address };
}

/** Eligibility context builder — the shape `selectRail` derives internally. */
function ctx(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    amount: 100,
    currency: 'USD',
    countryCode: 'US',
    email: 'payer@example.com',
    emailVerified: true,
    walletAddress: WALLET,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost model
// ─────────────────────────────────────────────────────────────────────────────

describe('rail cost model', () => {
  it('adds percentage, fixed and network fees together', () => {
    // $1,000 on Square: 2.9% = $29.00, plus the 30¢ fixed fee.
    expect(estimateRailCost('square', 1000)).toBeCloseTo(29.3, 5);
    expect(estimateRailCost('paypal', 1000)).toBeCloseTo(29.49, 5);
    expect(estimateRailCost('safepay', 1000)).toBeCloseTo(25, 5);
    expect(estimateRailCost('solana', 1000)).toBeCloseTo(RAIL_COSTS.solana.networkFee, 5);
    expect(estimateRailCost('bank', 1000)).toBe(0);
  });

  it('charges a small ticket a higher EFFECTIVE rate than a large one', () => {
    // This is why cost has to be computed per-transaction rather than read off
    // a static table. "Square is 2.9%" is only true asymptotically: the 30¢
    // fixed fee adds 6% on a $5 charge and 0.003% on a $10,000 one, so the
    // same rail costs 8.9% or 2.9% depending on the ticket.
    const effectiveRate = (amount: number) => estimateRailCost('square', amount) / amount;
    expect(effectiveRate(5)).toBeCloseTo(0.089, 3); // 8.9%
    expect(effectiveRate(50)).toBeCloseTo(0.035, 3); // 3.5%
    expect(effectiveRate(10000)).toBeCloseTo(0.02903, 5); // ~2.9%
    expect(effectiveRate(5)).toBeGreaterThan(effectiveRate(50));
    expect(effectiveRate(50)).toBeGreaterThan(effectiveRate(10000));
  });

  it('makes Solana cheaper than every fiat rail at every ticket size', () => {
    for (const amount of [5, 20, 100, 500, 5000]) {
      for (const rail of ['square', 'paypal', 'safepay'] as const) {
        expect(estimateRailCost('solana', amount)).toBeLessThan(estimateRailCost(rail, amount));
      }
    }
  });

  it('treats a non-positive or non-finite amount as zero rather than a negative fee', () => {
    expect(estimateRailCost('square', 0)).toBe(0.3);
    expect(estimateRailCost('square', -50)).toBe(0.3);
    expect(estimateRailCost('square', Number.NaN)).toBe(0.3);
  });

  /**
   * The cross-check against `fees.ts`.
   *
   * `PUBLISHED_RAIL_FEES` is the pre-existing home of "what does each rail cost
   * us", and `rail-cost.ts` was written afterwards. Two tables of processor
   * rates in one repository is precisely the defect `fees.ts` documents having
   * been burned by — it records six different rates for the same booking and
   * calls the resulting merchant bills unanswerable. This test is what stops
   * that from being reintroduced: change one, the other fails.
   *
   * Flat-fee rails are excluded because `PUBLISHED_RAIL_FEES` carries a
   * nominal bps for Solana ("25") purely so it sorts sensibly in reporting —
   * Solana's cost does not scale with the amount, so the bps is a label and
   * not a rate, and asserting they agree would be asserting a falsehood.
   */
  it('agrees with PUBLISHED_RAIL_FEES for every percentage-priced rail', () => {
    for (const rail of Object.keys(RAIL_COSTS) as Rail[]) {
      if (FLAT_FEE_RAILS.has(rail)) continue;
      const published = PUBLISHED_RAIL_FEES[rail];
      expect(published, `${rail} missing from PUBLISHED_RAIL_FEES`).toBeDefined();
      expect(RAIL_COSTS[rail].percentageFee * 10_000).toBe(published.bps);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 1 — cost-aware selection
// ─────────────────────────────────────────────────────────────────────────────

describe('Pattern 1: cost breaks ties, it does not lead', () => {
  /**
   * PayPal and bank are the pair that actually ties.
   *
   * Chosen deliberately rather than reaching for an obvious one like Square
   * versus SafePay: those two do NOT tie. SafePay is penalised 60 points for
   * not settling USD, so they are 107 points apart and cost never gets a say.
   * A test built on them would pass for the wrong reason — it would look like
   * proof that cost works when in fact cost was never consulted.
   *
   * PayPal (affinity 20, currency +12 = 32) and bank (affinity 10, +12 = 22)
   * are 10 apart, inside COST_TIEBREAK_BAND, with PayPal the more expensive
   * one. That is exactly the situation cost exists to resolve.
   */
  const tiedMethods = [method('paypal', PAYPAL_LINK), method('bank', 'IBAN GB29 NWBK 6016 1331 9268 19')];

  /**
   * A verified passport, so PayPal is eligible. Without `verified: true` the
   * router correctly refuses PayPal and the test would pass by accident — with
   * one candidate instead of two, there is no tie for cost to break.
   */
  const verified = { paymentScore: 500, walletAddress: null, verified: true } as const;

  it('selects the cheaper of two otherwise-equal rails', () => {
    const selection = selectRail(invoice(50), client(null), tiedMethods, { currency: 'USD', passport: verified });

    expect(selection.costDecided).toBe(true);
    // PayPal costs 2.9% + 49¢ on $50. Bank costs nothing at all.
    expect(selection.method.railId).toBe('bank');
    expect(selection.estimatedCostUsd).toBe(0);
  });

  it('explains the choice with a cost comparison', () => {
    const selection = selectRail(invoice(50), client(null), tiedMethods, { currency: 'USD', passport: verified });
    // The reasoning has to carry the comparison, or a merchant who notices a
    // rail change has no way to find out why.
    expect(selection.reasoning).toMatch(/cheapest for this amount/);
    expect(selection.reasoning).toMatch(/\$0\.00 on Bank Transfer/);
    expect(selection.reasoning).toMatch(/\$1\.94 on PayPal/); // 2.9% of $50 + $0.49
  });

  it('reports estimated cost on every candidate, not just the winner', () => {
    const selection = selectRail(invoice(50), client(null), tiedMethods, { currency: 'USD', passport: verified });
    const costs = Object.fromEntries(selection.candidates.map((c) => [c.railId, c.estimatedCostUsd]));
    expect(costs.paypal).toBeCloseTo(estimateRailCost('paypal', 50), 5);
    expect(costs.bank).toBe(0);
  });

  it('puts the cost winner first, not merely somewhere in the list', () => {
    // A tiebreaker that reorders the tail and leaves the head alone computes
    // the right answer and then never uses it.
    const selection = selectRail(invoice(50), client(null), tiedMethods, { currency: 'USD', passport: verified });
    expect(selection.candidates[0].railId).toBe('bank');
    expect(selection.method.railId).toBe(selection.candidates[0].railId);
  });

  it('never lets cost outvote a trust or geography difference wider than the band', () => {
    // A US client gives Square a +45 geographic bonus, far outside the band.
    // PayPal and Square then sit 90 points apart, and the far more expensive
    // Square must still win — otherwise cost has quietly become the primary
    // signal, which is the one thing it must never be.
    const methods = [method('square', SQUARE_LINK), method('paypal', PAYPAL_LINK)];
    const selection = selectRail(invoice(50), client('500 Market St, San Francisco, United States'), methods, {
      currency: 'USD',
    });

    expect(selection.method.railId).toBe('square');
    expect(selection.costDecided).toBe(false);
    const squareScore = selection.candidates.find((c) => c.railId === 'square')?.score ?? 0;
    const paypalScore = selection.candidates.find((c) => c.railId === 'paypal')?.score ?? 0;
    expect(squareScore - paypalScore).toBeGreaterThan(COST_TIEBREAK_BAND);
  });

  it('keeps the band narrow enough that cost cannot become the primary signal', () => {
    // Guards the constant against someone widening it to make cost "work
    // better". Trust and geography factors run to 45 and 60 points; a band
    // wider than that would let a two-cent saving overrule a low-trust client.
    expect(COST_TIEBREAK_BAND).toBeGreaterThan(0);
    expect(COST_TIEBREAK_BAND).toBeLessThanOrEqual(20);
  });

  it('moves the cost figures with the amount, not just the winner', () => {
    // Same two rails, same client, two ticket sizes on the SAME side of the
    // small-ticket threshold so the affinity scores — and therefore the tie —
    // are unchanged. Only the money moves.
    const small = selectRail(invoice(20), client(null), tiedMethods, { currency: 'USD', passport: verified });
    const large = selectRail(invoice(400), client(null), tiedMethods, { currency: 'USD', passport: verified });

    expect(small.method.railId).toBe('bank');
    expect(large.method.railId).toBe('bank');
    const paypalCost = (s: typeof small) => s.candidates.find((c) => c.railId === 'paypal')!.estimatedCostUsd;
    expect(paypalCost(large)).toBeGreaterThan(paypalCost(small));
  });

  it('lets PayPal win above the small-ticket threshold, where affinity says so', () => {
    // Crosses SMALL_TICKET_MAX, which adds +15 to PayPal and nothing to bank.
    // That is a genuine 25-point gap, outside the band, so cost does not get a
    // say — the router is allowed to prefer PayPal on a large ticket, and does.
    const selection = selectRail(invoice(5000), client(null), tiedMethods, { currency: 'USD', passport: verified });
    expect(selection.method.railId).toBe('paypal');
    expect(selection.costDecided).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 2 — fallback chain and eligibility
// ─────────────────────────────────────────────────────────────────────────────

describe('Pattern 2: eligibility gates, fallback chains carry the rest', () => {
  it('refuses Square for a client outside its markets', () => {
    const verdict = canHandle('square', ctx({ countryCode: 'PK' }));
    expect(verdict.eligible).toBe(false);
    expect(verdict.blocked?.code).toBe('wrong_country');
  });

  it('refuses Square when the country is unknown rather than assuming', () => {
    const verdict = canHandle('square', ctx({ countryCode: null }));
    expect(verdict.eligible).toBe(false);
    expect(verdict.blocked?.code).toBe('unknown_country');
  });

  it('requires a verified email for PayPal', () => {
    expect(canHandle('paypal', ctx({ email: null })).blocked?.code).toBe('no_email');
    expect(canHandle('paypal', ctx({ emailVerified: false })).blocked?.code).toBe('unverified_email');
    expect(canHandle('paypal', ctx()).eligible).toBe(true);
  });

  it('requires both a PK client and PKR for Safepay', () => {
    expect(canHandle('safepay', ctx({ countryCode: 'PK', currency: 'PKR' })).eligible).toBe(true);
    expect(canHandle('safepay', ctx({ countryCode: 'US', currency: 'PKR' })).blocked?.code).toBe('wrong_country');
    expect(canHandle('safepay', ctx({ countryCode: 'PK', currency: 'USD' })).blocked?.code).toBe('currency_unsupported');
  });

  it('treats bank as always eligible, so the chain can never dead-end', () => {
    // Every other predicate can refuse. This one cannot, which is what makes
    // "no eligible rail" a genuinely impossible state rather than a rare one.
    for (const countryCode of ['US', 'PK', null] as const) {
      expect(canHandle('bank', ctx({ countryCode, email: null, emailVerified: false, walletAddress: null })).eligible).toBe(true);
    }
  });

  it('rejects Square for a Pakistani client and says why', () => {
    const methods = [method('square', SQUARE_LINK), method('safepay', SAFEPAY_LINK)];
    const selection = selectRail(invoice(5000, 'PKR'), client('12 Gulberg, Lahore, Pakistan', null), methods, {
      currency: 'PKR',
    });

    expect(selection.method.railId).toBe('safepay');
    expect(selection.primaryRailId).toBe('safepay');

    // Square is reported as REJECTED, not as "fell back from". Those are
    // different failures: a fall-back means we chose something else, a
    // rejection means the merchant's method cannot reach this client and is
    // worth fixing. Conflating them would send someone looking for the wrong
    // problem.
    //
    // It is not in the prose reasoning either, because Square does not appear
    // on the PKR chain at all — a PKR invoice can never route through it, so
    // it is not what steered the decision. `rejectedRails` is the right channel
    // for it, and the UI can show it without polluting every routing line.
    const squareRejection = selection.rejectedRails.find((r) => r.railId === 'square');
    expect(squareRejection?.reason).toMatch(/does not settle for PK/);
    expect(selection.reasoning).not.toMatch(/Square not usable/);
  });

  it('names the rejection in the reasoning when the rejected rail was on the chain', () => {
    // A PK client paying USD does go through Square in the chain order, so its
    // rejection is genuinely the reason we landed on bank — and that belongs in
    // the sentence a human reads.
    const selection = selectRail(
      invoice(50, 'USD'),
      client('12 Gulberg, Lahore, Pakistan', null),
      [method('square', SQUARE_LINK), method('bank', 'IBAN GB29 NWBK 6016 1331 9268 19')],
      { currency: 'USD' },
    );

    expect(selection.method.railId).toBe('bank');
    expect(selection.reasoning).toMatch(/Square not usable for this client \(Square does not settle for PK clients\)/);
  });

  it('reports the chain position of the rail it fell back to', () => {
    const chain = fallbackChainFor({ countryCode: 'PK', currency: 'PKR' });
    expect(chain[0]).toBe('safepay');

    const walk = walkFallbackChain(chain, ctx({ countryCode: 'PK', currency: 'PKR', walletAddress: null }));
    expect(walk.rail).toBe('safepay');
    expect(walk.chosen?.priority).toBe(1);
  });

  it('walks past an excluded rail without claiming it was ineligible', () => {
    // A retried rail had its turn; reporting it as "could not use it" would be
    // a different and wrong claim, and would mislead whoever reads the log.
    const chain: Rail[] = ['square', 'paypal', 'bank'];
    const walk = walkFallbackChain(chain, ctx(), new Set<Rail>(['square']));

    expect(walk.rail).toBe('paypal');
    expect(walk.steps.map((s) => s.rail)).toEqual(['paypal']);
    expect(walk.chosen?.priority).toBe(2);
  });

  it('lets currency override country, because currency is the harder constraint', () => {
    // A PK client paying USD gets the USD chain, not the PK one. PKR invoices
    // cannot be collected in USD regardless of who the client is.
    const usdForPk = fallbackChainFor({ countryCode: 'PK', currency: 'USD' });
    expect(usdForPk).toEqual(RAIL_FALLBACK.byCurrency?.USD);

    const pkrChain = fallbackChainFor({ countryCode: 'US', currency: 'PKR' });
    expect(pkrChain).toEqual(RAIL_FALLBACK.byCurrency?.PKR);
    // PKR can never route through a card rail.
    expect(pkrChain).not.toContain('square');
    expect(pkrChain).not.toContain('paypal');
  });

  it('falls back to the default order when nothing is known', () => {
    expect(fallbackChainFor({ countryCode: null, currency: null })).toEqual(RAIL_FALLBACK.defaultOrder);
  });

  it('ends every fiat chain at bank', () => {
    // USDC is excluded on purpose and asserts the opposite: it settles natively
    // on Solana, so its chain is a deliberate singleton and naming bank as a
    // USDC fallback would be a claim that bank can settle stablecoins, which
    // it cannot.
    for (const currency of ['USD', 'PKR', 'EUR']) {
      for (const countryCode of ['US', 'PK', null] as const) {
        const chain = fallbackChainFor({ countryCode, currency });
        expect(chain[chain.length - 1]).toBe('bank');
      }
    }
    expect(fallbackChainFor({ countryCode: 'US', currency: 'USDC' })).toEqual(['solana']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Crypto eligibility — the pattern that Hyperswitch does not have
// ─────────────────────────────────────────────────────────────────────────────

describe('crypto eligibility', () => {
  it('skips Solana in the fallback chain for a client with no wallet', () => {
    const chain: Rail[] = ['solana', 'square', 'bank'];
    const walk = walkFallbackChain(chain, ctx({ walletAddress: null }));

    expect(walk.rail).toBe('square');
    expect(walk.steps[0].rail).toBe('solana');
    expect(walk.steps[0].verdict.blocked?.code).toBe('no_wallet');
  });

  it('skips Solana even though it is the cheapest rail available', () => {
    // The point of the gate: cost must never resurrect a rail the client
    // cannot be reached on. This is the case the whole pattern exists for.
    const walletless = ctx({ walletAddress: null });
    const withWallet = ctx({ walletAddress: WALLET });

    const walletlessChain = walkFallbackChain(['solana', 'bank'], walletless);
    const withWalletChain = walkFallbackChain(['solana', 'bank'], withWallet);

    expect(walletlessChain.rail).toBe('bank');
    expect(withWalletChain.rail).toBe('solana');
    expect(estimateRailCost('solana', 100)).toBeLessThan(estimateRailCost('bank', 100) + 1);
  });

  it('rejects a wallet address that is present but malformed', () => {
    // A non-empty string is not a usable wallet. If a truncated or mistyped
    // address counted as present, Solana would be offered to clients it can
    // never actually reach, and the payment would simply never land.
    const verdict = canHandle('solana', ctx({ walletAddress: 'not-a-wallet' }));
    expect(verdict.eligible).toBe(false);
    expect(verdict.blocked?.code).toBe('no_wallet');
  });

  it('offers Solana as the primary rail when it is the only rail registered', () => {
    const selection = selectRail(
      invoice(50),
      client(null),
      [method('solana', WALLET)],
      { currency: 'USD', passport: { paymentScore: 500, walletAddress: WALLET, verified: true } },
    );

    expect(selection.primaryRailId).toBe('solana');
    expect(selection.method.railId).toBe('solana');
  });

  it('does NOT offer Solana over a Square method just because it is free', () => {
    // Square's affinity and currency scores put it ~43 points ahead of Solana
    // on a small USD ticket — far outside the band. This is the constraint
    // doing its job: a free rail must not capture an invoice just by being
    // cheap. If cost ever does overturn this, the band has been widened past
    // the point where "tiebreaker" is still true.
    const selection = selectRail(
      invoice(50),
      client('500 Market St, San Francisco, United States'),
      [method('square', SQUARE_LINK), method('solana', WALLET)],
      { currency: 'USD', passport: { paymentScore: 500, walletAddress: WALLET, verified: true } },
    );

    expect(selection.method.railId).toBe('square');
    expect(selection.costDecided).toBe(false);
  });

  it('skips Solana and routes to Square when the client has no wallet', () => {
    const selection = selectRail(
      invoice(50),
      client('500 Market St, San Francisco, United States'),
      [method('square', SQUARE_LINK), method('solana', WALLET)],
      { currency: 'USD', passport: { paymentScore: 500, walletAddress: null, verified: true } },
    );

    expect(selection.method.railId).toBe('square');
    // The rejection is the useful output here: it is what tells a merchant
    // that linking a wallet would open up their cheapest rail.
    const rejection = selection.rejectedRails.find((r) => r.railId === 'solana');
    expect(rejection?.reason).toMatch(/no linked wallet/);
  });

  it('refuses to route at all when every registered rail is ineligible', () => {
    // Square is blocked by an unknown country and Solana by a missing wallet,
    // so there is genuinely nowhere to send this payment. Saying so is the
    // correct outcome; quietly falling back to a rail that cannot settle
    // would produce a payment link that fails silently for the client.
    expect(() =>
      selectRail(invoice(50), client(null), [method('square', SQUARE_LINK), method('solana', WALLET)], {
        currency: 'USD',
        passport: { paymentScore: 500, walletAddress: null, verified: true },
      }),
    ).toThrow(/No eligible payment rail/);
  });

  it('names both rejections in the error, so the cause is diagnosable', () => {
    let message = '';
    try {
      selectRail(invoice(50), client(null), [method('square', SQUARE_LINK), method('solana', WALLET)], {
        currency: 'USD',
        passport: { paymentScore: 500, walletAddress: null, verified: true },
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/square/);
    expect(message).toMatch(/solana/);
    expect(message).toMatch(/no linked wallet/);
  });

  it('has no fallback at all for a USDC invoice from a wallet-less client', () => {
    // USDC settles natively on Solana and nowhere else, so a client with no
    // wallet genuinely has no rail. The honest outcome is to say so, not to
    // route them somewhere that cannot settle USDC.
    const chain = fallbackChainFor({ countryCode: 'US', currency: 'USDC' });
    expect(chain).toEqual(['solana']);
    expect(walkFallbackChain(chain, ctx({ walletAddress: null })).rail).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pattern 3 — auto-retry policy
// ─────────────────────────────────────────────────────────────────────────────

describe('Pattern 3: retry policy', () => {
  it('allows two retries by default', () => {
    expect(MAX_RETRIES).toBe(2);
  });

  it('classifies a shortfall as insufficient funds, not as congestion', () => {
    // Getting this backwards would send a payer with an empty account to a
    // different processor, where the same empty account fails identically.
    expect(classifyFailure('Insufficient funds')).toBe('insufficient_funds');
    expect(classifyFailure('Your account balance is too low')).toBe('insufficient_funds');
  });

  it('classifies an unlanded Solana transaction as congestion', () => {
    expect(classifyFailure('Transaction not landed within 30s')).toBe('congestion');
    expect(classifyFailure('block height exceeded')).toBe('congestion');
    expect(classifyFailure('Priority fee too low to land')).toBe('congestion');
  });

  it('classifies a card decline as declined, and neither word as congestion', () => {
    // "declined" contains no substring of the congestion list, which is the
    // point: a card decline must never be retried on the same rail.
    expect(classifyFailure('card_declined')).toBe('declined');
    expect(shouldRetrySameRail('square', classifyFailure('card_declined'))).toBe(false);
  });

  it('falls back to unknown rather than guessing', () => {
    expect(classifyFailure(null)).toBe('unknown');
    expect(classifyFailure('')).toBe('unknown');
    expect(classifyFailure('something we have never seen')).toBe('unknown');
  });

  it('retries a congested Solana payment on Solana, at a higher priority fee', () => {
    // The client's wallet is already funded. Moving a sub-cent payment to a
    // card rail to clear a network queue would cost ~3% and hand them a
    // method they have never used at the worst possible moment.
    expect(shouldRetrySameRail('solana', 'congestion')).toBe(true);
    expect(SOLANA_RETRY_PRIORITY_MULTIPLIER).toBeGreaterThan(1);
  });

  it('does not retry Solana on itself for a payer-side failure', () => {
    expect(shouldRetrySameRail('solana', 'insufficient_funds')).toBe(false);
    expect(shouldRetrySameRail('solana', 'declined')).toBe(false);
    expect(shouldRetrySameRail('solana', 'unknown')).toBe(false);
  });

  it('never retries a fiat rail on itself, whatever the reason', () => {
    for (const rail of ['square', 'paypal', 'safepay', 'bank'] as const) {
      expect(shouldRetrySameRail(rail, 'congestion')).toBe(false);
    }
  });

  it('gives exactly MAX_RETRIES retries before escalating', () => {
    // Mirrors the increment in payment-retry.service: each failure spends one,
    // and the budget is exhausted once the count passes MAX_RETRIES.
    let retryCount = 0;
    const outcomes: string[] = [];
    for (let failure = 0; failure < 4; failure += 1) {
      retryCount += 1;
      outcomes.push(retryCount > MAX_RETRIES ? 'exhausted' : 'retried');
    }
    expect(outcomes).toEqual(['retried', 'retried', 'exhausted', 'exhausted']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settlement finality
// ─────────────────────────────────────────────────────────────────────────────

describe('settlement finality', () => {
  const matchedAt = new Date('2026-10-10T12:00:00.000Z');

  it('marks a confirmed Solana payment settled immediately', () => {
    const decision = settlementDecision('solana', matchedAt);
    expect(decision.status).toBe('settled');
    // No window to wait out: it is either final or it is not, at the moment of
    // confirmation. A non-null date here would mean holding Solana payments
    // "pending" for months for no reason.
    expect(decision.settlesAt).toBeNull();
  });

  it('marks a Square payment pending until the chargeback window closes', () => {
    const decision = settlementDecision('square', matchedAt);
    expect(decision.status).toBe('pending');
    expect(decision.settlesAt).toEqual(new Date('2027-02-07T12:00:00.000Z')); // +120 days
    expect(finalityFor('square')).toBe('delayed');
  });

  it('marks a bank transfer reversible, which is not the same as pending', () => {
    // A pending payment will end one way on its own. A reversible one is a
    // right the payer holds until the notice period expires, and escrow held
    // against one deserves different treatment.
    const decision = settlementDecision('bank', matchedAt);
    expect(decision.status).toBe('reversible');
    expect(finalityFor('bank')).toBe('reversible');
  });

  it('gives a Solana payment a shorter window than any fiat rail', () => {
    expect(settlementDecision('solana', matchedAt).settlesAt).toBeNull();
    for (const rail of ['square', 'paypal', 'safepay', 'bank'] as const) {
      const decision = settlementDecision(rail, matchedAt);
      expect(decision.settlesAt).not.toBeNull();
      expect(decision.settlesAt!.getTime()).toBeGreaterThan(matchedAt.getTime());
    }
  });

  it('explains itself in every case', () => {
    for (const rail of Object.keys(RAIL_COSTS) as Rail[]) {
      expect(settlementDecision(rail, matchedAt).explanation.length).toBeGreaterThan(10);
    }
  });
});