/**
 * Fallback ordering and per-rail ELIGIBILITY.
 *
 * ─── WHAT THIS FILE IS FOR ──────────────────────────────────────────────────
 * `selectRail()` answers "given everything we know, which rail is best". This
 * file answers the question it cannot: "and if that one turns out not to be
 * usable for this particular client, what do we do instead?"
 *
 * The two are different questions and the codebase has a reason to keep them
 * apart. `selectRail` ranks by trust and geography — signals about the CLIENT.
 * Eligibility is about whether a rail can physically complete this transaction
 * for this payer at all. A client in Karachi with no wallet is not
 * "less suited" to Solana; Solana cannot reach them. Ranking can express a
 * preference; it cannot express impossibility, and pretending otherwise is how a
 * routing table ends up sending a payment somewhere it can never land.
 *
 * ─── WHY BANK IS ALWAYS LAST ────────────────────────────────────────────────
 * Because it is the only rail with no automated payment link.
 * `payments/rails/bank.rail.ts` returns `''` from `getPaymentUrl` — there is
 * no URL for a bank transfer. `validateTarget` accepts any string longer than
 * ten characters, which is why the rail router's `usable` filter lets it
 * through. It is genuinely available, and genuinely manual, and that is
 * precisely why it is the safety net and not the default.
 */

import type { Rail } from './rail-cost';

/** ISO-3166 alpha-2 codes we key fallback chains by. */
export type CountryCode = 'US' | 'CA' | 'GB' | 'AU' | 'PK' | 'AE' | 'SA';

/**
 * What eligibility is judged against.
 *
 * Deliberately a flat, Prisma-free shape rather than `Invoice` / `CrmClient`.
 * Eligibility is a policy question and should be answerable — and testable —
 * without a database row, so the predicates below take this and not a model.
 */
export interface EligibilityContext {
  /** Charge amount in the invoice's own units. */
  amount: number;
  /** Upper-case currency code, or null when the invoice carries none. */
  currency: string | null;
  /** ISO-3166 country of the payer, or null when we could not tell. */
  countryCode: CountryCode | null;
  /** Payer email. Present-but-unverified is treated as absent — see below. */
  email: string | null;
  /** Whether that email has been verified. */
  emailVerified: boolean;
  /**
   * Payer's Solana address, from `TrustPassport.walletAddress` via
   * `CrmClient.passportId`.
   *
   * It is a passport field and not a client field because `CrmClient` has no
   * wallet column — see the migration note in `rail-cost.ts`'s sibling work.
   * Because the column is `@unique`, a passport carries at most one wallet,
   * which is also why a payer cannot be offered two Solana rails.
   */
  walletAddress: string | null;
}

/** Why a rail cannot take this transaction. Null means it can. */
export interface Ineligible {
  code: 'no_email' | 'unverified_email' | 'wrong_country' | 'unknown_country' | 'no_wallet' | 'currency_unsupported';
  reason: string;
}

export interface EligibilityVerdict {
  eligible: boolean;
  /** Populated when `eligible` is false. */
  blocked: Ineligible | null;
}

const ELIGIBLE: EligibilityVerdict = { eligible: true, blocked: null };

function blocked(code: Ineligible['code'], reason: string): EligibilityVerdict {
  return { eligible: false, blocked: { code, reason } };
}

/**
 * Countries where a country's own card rail actually settles locally.
 *
 * Square's presence in the UK and Australia is real, but these are the markets
 * its payout and support coverage is built around. A UK client routed to Square
 * works; a Pakistani client routed to Square does not, which is the entire
 * reason Safepay is in this system.
 */
const SQUARE_MARKETS: ReadonlySet<CountryCode> = new Set<CountryCode>(['US', 'CA', 'GB', 'AU']);

function isUsableEmail(ctx: EligibilityContext): boolean {
  const email = ctx.email?.trim() ?? '';
  return email.length > 0 && email.includes('@') && ctx.emailVerified;
}

/**
 * Can this rail take this transaction from this payer?
 *
 * Every rail's predicate is written out rather than inferred, because "which
 * rails can reach this client" is exactly the question that was previously
 * unanswerable and got answered by guessing in the other direction — the old
 * router would happily return Square for a client whose address said Pakistan,
 * with no rail left to fall back to when it did not work.
 */
export function canHandle(rail: Rail, ctx: EligibilityContext): EligibilityVerdict {
  switch (rail) {
    case 'square': {
      if (!ctx.countryCode) {
        return blocked('unknown_country', 'no country on file for this client, so Square coverage is unknown');
      }
      if (!SQUARE_MARKETS.has(ctx.countryCode)) {
        return blocked('wrong_country', `Square does not settle for ${ctx.countryCode} clients`);
      }
      return ELIGIBLE;
    }

    case 'paypal': {
      if (!ctx.email) return blocked('no_email', 'PayPal needs an email to send a payment request to');
      if (!isUsableEmail(ctx)) {
        return blocked('unverified_email', 'PayPal payment requests need a verified email');
      }
      return ELIGIBLE;
    }

    case 'safepay': {
      if (ctx.countryCode !== 'PK') {
        return blocked('wrong_country', 'Safepay is a PK-only rail');
      }
      if (ctx.currency && ctx.currency.toUpperCase() !== 'PKR') {
        return blocked('currency_unsupported', `Safepay settles PKR, not ${ctx.currency}`);
      }
      return ELIGIBLE;
    }

    case 'solana': {
      const wallet = ctx.walletAddress?.trim() ?? '';
      if (!wallet) {
        return blocked('no_wallet', 'no linked wallet on this client, so Solana cannot reach them');
      }
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
        return blocked('no_wallet', 'the linked wallet address is not a valid Solana address');
      }
      return ELIGIBLE;
    }

    case 'bank':
      // Always eligible, by design. This is the rail the chain bottoms out at
      // precisely so that "nothing works" is never the answer.
      return ELIGIBLE;
  }
}

/**
 * Priority-ordered fallback chains.
 *
 * Most-specific key wins, in the order currency → country → default. Currency is
 * checked first because it is the harder constraint: a PKR invoice cannot be
 * collected in USD no matter who the client is, so a currency chain that omits
 * Square should beat a country chain that would suggest it.
 */
export interface RailFallbackChain {
  /** Ordered highest priority first. */
  defaultOrder: Rail[];
  byCountry?: Partial<Record<CountryCode, Rail[]>>;
  byCurrency?: Record<string, Rail[]>;
}

export const RAIL_FALLBACK: RailFallbackChain = {
  /**
   * The no-information case, and it puts Solana first.
   *
   * That is aggressive and it is deliberate: it is only reached when we know
   * neither the country nor the currency, and on an unknown client the cheapest
   * rail that might work is the better bet than a 2.9% one. `canHandle` still
   * vetoes Solana for anyone without a wallet, so the cost of being wrong is a
   * fall-through to the next entry, not a dead end.
   */
  defaultOrder: ['solana', 'safepay', 'square', 'paypal', 'bank'],

  byCountry: {
    PK: ['safepay', 'solana', 'bank', 'paypal', 'square'],
    US: ['square', 'solana', 'paypal', 'bank'],
    CA: ['square', 'solana', 'paypal', 'bank'],
    GB: ['square', 'paypal', 'solana', 'bank'],
    AU: ['square', 'paypal', 'solana', 'bank'],
    AE: ['paypal', 'solana', 'bank'],
    SA: ['paypal', 'solana', 'bank'],
  },

  byCurrency: {
    /**
     * PKR cannot be collected on the international card rails at all. This
     * chain is a hard constraint, not a preference — Safepay or bank, and
     * `canHandle` confirms the client is actually in Pakistan for Safepay to
     * be offered.
     */
    PKR: ['safepay', 'bank'],
    /**
     * USDC settles natively on Solana, so a stablecoin-denominated invoice has
     * no reason to touch a card rail. A length-1 chain is intentional: there is
     * no second option, so if the client has no wallet this is the case where
     * `selectRail` has to say so rather than route somewhere that cannot pay.
     */
    USDC: ['solana'],
    USD: ['square', 'paypal', 'solana', 'bank'],
    EUR: ['paypal', 'square', 'solana', 'bank'],
  },
};

/**
 * The chain to walk for a given client.
 *
 * Returns a fresh array: the result is filtered and re-ordered by the router,
 * and mutating `RAIL_FALLBACK` in place would be a way to lose the defaults for
 * every later call.
 */
export function fallbackChainFor(ctx: Pick<EligibilityContext, 'countryCode' | 'currency'>): Rail[] {
  const currency = ctx.currency?.trim().toUpperCase();
  const byCurrency = currency ? RAIL_FALLBACK.byCurrency?.[currency] : undefined;
  if (byCurrency) return [...byCurrency];

  const byCountry = ctx.countryCode ? RAIL_FALLBACK.byCountry?.[ctx.countryCode] : undefined;
  if (byCountry) return [...byCountry];

  return [...RAIL_FALLBACK.defaultOrder];
}

/**
 * Retry attempts before a payment is escalated to failure ownership.
 *
 * Two, which is "one retry and one more", not "three tries". The reason it is
 * low: each attempt is a different rail, and the chain is finite. A payer who
 * has failed on Square and PayPal is not going to succeed on bank transfer
 * without being asked to, and burning their inbox and ours to find that out is
 * worse than escalating early.
 */
export const MAX_RETRIES = 2;

/**
 * Priority-fee multiplier when retrying a congested Solana transaction.
 *
 * Congestion is a queue, not a fault — the transaction was valid and was not
 * included in time. Paying more to be placed earlier is the correct remedy, so
 * this retry stays on the same rail where that is the failure.
 */
export const SOLANA_RETRY_PRIORITY_MULTIPLIER = 3;

/** One step of the chain, whether it succeeded or why it did not. */
export interface ChainStep {
  rail: Rail;
  /** 1-based position in the chain. This is the "priority" in the reasoning. */
  priority: number;
  verdict: EligibilityVerdict;
}

export interface ChainWalk {
  /** The rail to use, or null if every rail in the chain was ineligible. */
  rail: Rail | null;
  /** The step that succeeded, if any. */
  chosen: ChainStep | null;
  /** Every step taken, in order. Used to explain a fall-back. */
  steps: ChainStep[];
}

/**
 * Walk a chain until a rail is eligible, recording why each one was passed over.
 *
 * Returns the failures as well as the winner on purpose. "Fell back to Safepay"
 * is only useful to a merchant if it also says what happened to the rail that
 * came first, and a bare winner is indistinguishable from the primary rail
 * having simply won on merit.
 */
export function walkFallbackChain(chain: readonly Rail[], ctx: EligibilityContext, exclude: ReadonlySet<Rail> = new Set()): ChainWalk {
  const steps: ChainStep[] = [];
  for (let i = 0; i < chain.length; i += 1) {
    const rail = chain[i];
    // An excluded rail is not ineligible — it already had its turn. It is
    // skipped without a verdict so it does not read as "we could not use it" in
    // the reasoning, which would be a different and wrong claim.
    if (exclude.has(rail)) continue;

    const verdict = canHandle(rail, ctx);
    const step: ChainStep = { rail, priority: i + 1, verdict };
    steps.push(step);
    if (verdict.eligible) {
      return { rail, chosen: step, steps };
    }
  }
  return { rail: null, chosen: null, steps };
}

/**
 * Why a chain produced no usable rail.
 *
 * Only reached when every rail failed `canHandle`, which should be close to
 * impossible because `bank` is unconditionally eligible. It is still worth
 * saying out loud: a silent "no rail" here would surface as an unexplained
 * failure to send an invoice.
 */
export function describeExhaustion(steps: ChainStep[]): string {
  if (steps.length === 0) return 'no rails remained in the fallback chain';
  const reasons = steps.map((s) => `${s.rail} (${s.verdict.blocked?.reason ?? 'ineligible'})`);
  return `every rail in the chain was ineligible: ${reasons.join('; ')}`;
}

// ── Failure classification ───────────────────────────────────────────────────

/**
 * Why a payment failed, in the only terms that change what we do next.
 *
 * The distinction is the whole point of the retry. `insufficient_funds` is a
 * fact about the payer: their account is short, and presenting the same
 * balance to a different processor will fail identically. `congestion` is a
 * fact about the network: the transaction was valid and nobody got to it in
 * time. Everything else is unknown, and unknown is treated as the payer's
 * problem rather than the network's, because guessing wrong in the other
 * direction burns a retry on a rail switch that cannot possibly help.
 */
export type FailureKind = 'insufficient_funds' | 'congestion' | 'declined' | 'unknown';

/**
 * Classify a processor's failure wording.
 *
 * Every rail words declines differently and none of them use our vocabulary, so
 * matching is substring-based on the lower-cased message. That is unsatisfying
 * and still the right call: it errs toward `unknown`, which is the safe
 * default, because the cost of misreading a network problem as a payer problem
 * is a retry that could never have worked.
 *
 * Note that congestion only means anything on-chain — "declined" from a card
 * processor is the processor declining, not a queue.
 */
export function classifyFailure(reason: string | null | undefined): FailureKind {
  if (!reason) return 'unknown';
  const text = reason.toLowerCase();

  // Payer-side first. "Balance too low" and "priority fee too low" both contain
  // "too low", so checking the payer's wording first is what keeps a Solana
  // fee problem from being read as an empty wallet.
  if (
    text.includes('insufficient') ||
    text.includes('no_balance') ||
    text.includes('not enough funds') ||
    text.includes('balance') ||
    text.includes('exceeds') ||
    text.includes('funds available')
  ) {
    return 'insufficient_funds';
  }
  if (
    text.includes('block height') ||
    text.includes('congestion') ||
    text.includes('queue') ||
    text.includes('not landed') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('transaction expired') ||
    text.includes('priorit') ||
    text.includes('priority fee') ||
    text.includes('too low to land') ||
    text.includes('stale') ||
    text.includes('behind')
  ) {
    return 'congestion';
  }
  if (text.includes('declin') || text.includes('do_not_honor') || text.includes('do not honor')) {
    return 'declined';
  }
  return 'unknown';
}

/**
 * Can this failure be retried on the SAME rail at a higher priority fee?
 *
 * Only congestion on Solana. The reasoning is that a network queue is not a
 * payment problem: the payer's wallet is already set up and funded, so moving
 * them to a card rail to clear it would convert a payment costing fractions of
 * a cent into one costing about 3%, and hand them a method they have never
 * used at the exact moment they are most likely to give up. Paying more for
 * priority is the correct answer to a queue.
 *
 * Insufficient funds is the clearest case of "no" — the balance is the same
 * whichever processor looks at it.
 */
export function shouldRetrySameRail(rail: Rail, kind: FailureKind): boolean {
  return rail === 'solana' && kind === 'congestion';
}