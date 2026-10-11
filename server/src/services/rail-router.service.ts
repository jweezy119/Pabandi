import type { BusinessPaymentMethod, CrmClient, Invoice, TrustPassport } from '@prisma/client';
import { paymentRails } from '../payments/rails';
import { logger } from '../utils/logger';
import {
  RAIL_IDS as CONFIGURED_RAIL_IDS,
  Rail,
  estimateRailCost,
} from '../config/rail-cost';
import {
  canHandle,
  EligibilityContext,
  fallbackChainFor,
  type CountryCode,
} from '../config/rail-fallback';

/**
 * Rail Router — picks which already-wired rail settles a given invoice.
 *
 * WHY THIS EXISTS
 * A business can register several payment methods (BusinessPaymentMethod rows,
 * one per rail). Invoice send currently hardcodes `findFirst({ isDefault: true })`
 * and ignores the client entirely. This service replaces that with a decision
 * that can explain itself, so the business sees *why* a rail was chosen.
 *
 * SCOPE: Square, Solana, PayPal, Safepay, bank. No new rails are introduced.
 * The `paymentRails` registry (src/payments/rails) is the single source of
 * truth for what a rail is called and how it validates a target.
 *
 * ─── THE ORDER OF THE SIGNALS, AND WHY IT IS THAT ORDER ─────────────────────
 * Three things can influence the choice and they are not equally trustworthy:
 *
 *   1. Eligibility. Not a preference — a hard gate. A rail that cannot reach
 *      this payer is removed from the set entirely. It outranks everything
 *      because a good score cannot make an unreachable rail reachable.
 *   2. Trust score and geography. The primary signal. These are evidence about
 *      the payer: how they have behaved, where they are, whether the rail is
 *      native to them.
 *   3. Cost. A tiebreaker, and only ever a tiebreaker. Cost is the weakest of
 *      the three because it is the only one that is not about whether the
 *      payment will succeed — it is about who pays for it. Letting it lead
 *      would send every invoice down the cheapest rail that technically works,
 *      which is a margin optimisation dressed up as a routing decision.
 *
 * So cost can reorder rails that already agree on the things that matter, and
 * can do nothing at all otherwise. `COST_TIEBREAK_BAND` below is where "agree"
 * ends.
 */

export const RAIL_IDS = CONFIGURED_RAIL_IDS;
export type RailId = Rail;

export function isRailId(value: string): value is RailId {
  return (RAIL_IDS as readonly string[]).includes(value);
}

/** PaymentMethod is the brief's name for the existing BusinessPaymentMethod row. */
export type PaymentMethod = BusinessPaymentMethod;

/**
 * Trust scores live on TrustPassport (0-1000 per scoped dimension), reached
 * from CrmClient through the unique passportId. The brief's thresholds are
 * quoted on a 0-100 scale, so callers pass the normalised 0-100 value while
 * the raw passport score stays available for display.
 */
export const PAYMENT_SCORE_DEFAULT = 50;

export function normalisePaymentScore(raw: number | null | undefined): number {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return PAYMENT_SCORE_DEFAULT;
  // TrustPassport.paymentScore is 0-1000; the router speaks 0-100.
  return Math.max(0, Math.min(100, Math.round(raw / 10)));
}

// ── Client geo ───────────────────────────────────────────────────────────────
// CrmClient has no country column, only a free-text `address`. We recover a
// country hint from the tail of that string when it looks like one, and fall
// back to the business address so the router still has a signal.
//
// `code` is the ISO-3166 alpha-2 form. It exists because `rail-fallback.ts`
// keys its priority chains by country, and matching on "United Kingdom" versus
// "UK" versus "GB" in a config table is three ways to be wrong. One spelling,
// decided once, here.

const COUNTRY_HINTS: { match: RegExp; country: string; code: CountryCode | null; rails: RailId[] }[] = [
  { match: /\b(united states|usa|u\.s\.a?|united states of america)\b/i, country: 'United States', code: 'US', rails: ['square'] },
  { match: /\b(pakistan|pk|islamabad|karachi|lahore|peshawar)\b/i, country: 'Pakistan', code: 'PK', rails: ['safepay'] },
  { match: /\b(united kingdom|uk|u\.k\.|london|manchester)\b/i, country: 'United Kingdom', code: 'GB', rails: [] },
  { match: /\b(canada|toronto|vancouver)\b/i, country: 'Canada', code: 'CA', rails: ['square'] },
  { match: /\b(australia|sydney|melbourne)\b/i, country: 'Australia', code: 'AU', rails: ['square'] },
  { match: /\b(uae|dubai|abu dhabi|emirates)\b/i, country: 'UAE', code: 'AE', rails: [] },
  { match: /\b(germany|frankfurt|berlin|munich)\b/i, country: 'Germany', code: null, rails: [] },
  { match: /\b(saudi arabia|riyadh|jeddah)\b/i, country: 'Saudi Arabia', code: 'SA', rails: [] },
  { match: /\b(india|delhi|mumbai|bangalore)\b/i, country: 'India', code: null, rails: [] },
];

export interface ClientGeoHint {
  country: string | null;
  /** ISO-3166 alpha-2, or null for a recognised country with no fallback chain. */
  countryCode: CountryCode | null;
  source: 'client_address' | 'business_address' | 'unknown';
  /** Rails that settle natively in this country, most-preferred first. */
  preferredRails: RailId[];
}

export function resolveClientGeoHint(clientAddress: string | null | undefined, businessAddress?: string | null): ClientGeoHint {
  const fromClient = matchCountry(clientAddress);
  if (fromClient) return { ...fromClient, source: 'client_address' };

  const fromBusiness = matchCountry(businessAddress);
  if (fromBusiness) return { ...fromBusiness, source: 'business_address' };

  return { country: null, countryCode: null, source: 'unknown', preferredRails: [] };
}

function matchCountry(address: string | null | undefined): { country: string; countryCode: CountryCode | null; preferredRails: RailId[] } | null {
  if (!address || typeof address !== 'string') return null;
  for (const hint of COUNTRY_HINTS) {
    if (hint.match.test(address)) {
      return { country: hint.country, countryCode: hint.code, preferredRails: hint.rails };
    }
  }
  return null;
}

// ── Terms recommendation (Commit 4) ──────────────────────────────────────────

export type TermsTier = 'net_30' | 'immediate' | 'deposit_escrow';

export interface TermsRecommendation {
  tier: TermsTier;
  label: string;
  /** Days from issue to due date that the recommendation implies. */
  dueInDays: number;
  requireEscrow: boolean;
  reason: string;
  paymentScore: number;
}

export function recommendTerms(paymentScore: number): TermsRecommendation {
  if (paymentScore >= 70) {
    return {
      tier: 'net_30',
      label: 'Net-30',
      dueInDays: 30,
      requireEscrow: false,
      reason: `Client's ${paymentScore} payment score supports extended terms.`,
      paymentScore,
    };
  }
  if (paymentScore >= 40) {
    return {
      tier: 'immediate',
      label: 'Immediate payment',
      dueInDays: 0,
      requireEscrow: false,
      reason: `Client's ${paymentScore} payment score supports standard terms on the standard rail.`,
      paymentScore,
    };
  }
  return {
    tier: 'deposit_escrow',
    label: 'Deposit required, escrow if available',
    dueInDays: 0,
    requireEscrow: true,
    reason: `Client's ${paymentScore} payment score is below 40 — collect up front and hold in escrow.`,
    paymentScore,
  };
}

// ── Rail scoring ─────────────────────────────────────────────────────────────

export interface RailScore {
  railId: RailId;
  score: number;
  reasons: string[];
  /** What this rail costs us for this specific amount. See rail-cost.ts. */
  estimatedCostUsd: number;
}

/**
 * Rails that cost nothing but also collect nothing by themselves.
 *
 * `bank.rail` returns `''` from `getPaymentUrl` — a bank transfer has no URL,
 * and its `validateTarget` only checks that the string is longer than ten
 * characters. It is a legitimate way for a client to pay (that is the entire
 * point of the rail) but it cannot complete a payment on its own.
 *
 * It is excluded from the cost tiebreaker for exactly that reason. Its cost is
 * structurally zero, so it sits at the bottom of every comparison and would
 * win any band it appeared in — which meant that adding cost-aware selection
 * made "bank transfer" the answer to nearly every invoice, handing the client
 * a dead invoice with no payment link. Cost is only a meaningful signal among
 * rails that can actually take the money, so the comparison happens among
 * those.
 *
 * Bank still wins when it genuinely should: when it is the only rail the
 * business has registered, or when trust and geography put it far ahead. That
 * is the "final fallback" role the chain gives it, and it is unaffected.
 */
const NON_AUTOMATABLE_RAILS: ReadonlySet<RailId> = new Set<RailId>(['bank']);

/**
 * How close two scores have to be before cost is allowed to break the tie.
 *
 * The scoring below produces integers on a scale where the factors are worth
 * 8–60 points each, so exact ties essentially never happen on their own. A
 * literal tiebreaker would therefore be dead code — correct, tested, and never
 * once invoked in production, which is the worst outcome for a routing rule
 * because it looks like it is working.
 *
 * So "tie" is defined as a band rather than an equality. Fifteen points is
 * roughly one weak factor (a small-ticket bonus, or being the business
 * default) against a strong one. That is the size of difference we are willing
 * to call "these two rails are equally good for this client, so take the
 * cheaper one". Widening it would let cost quietly outvote trust; the band is
 * narrow enough that it cannot.
 */
export const COST_TIEBREAK_BAND = 15;

export interface RailSelection {
  method: PaymentMethod;
  reasoning: string;
  termsRecommendation: TermsRecommendation;
  /** Ranked alternatives, best first. Useful for the UI and for logging. */
  candidates: { railId: RailId; displayName: string; score: number; estimatedCostUsd: number }[];
  paymentScore: number;
  clientCountry: string | null;
  geoSource: ClientGeoHint['source'];
  /**
   * The rail the chain offered FIRST, before eligibility was applied.
   *
   * Usually the same as `method.railId`. It differs when the preferred rail
   * turned out to be unusable for this client, which is the case worth
   * surfacing — a merchant who sees their Square method silently ignored needs
   * to know it was rejected rather than merely out-scored.
   */
  primaryRailId: RailId | null;
  /** Set when the winner was reached by falling past the chain's first choice. */
  fellBackFrom: { railId: RailId; priority: number; reason: string } | null;
  /**
   * Registered rails that were removed before scoring, and why.
   *
   * Separate from `fellBackFrom` because the two answer different questions.
   * `fellBackFrom` is "we moved off our preference"; this is "your Square
   * method cannot reach this client". A merchant whose only method was
   * rejected on eligibility needs to see the second, and it is the one that
   * tells them to fix something.
   */
  rejectedRails: { railId: RailId; reason: string }[];
  /** True when cost, rather than trust or geography, decided the ordering. */
  costDecided: boolean;
  /** What the chosen rail costs for this amount. */
  estimatedCostUsd: number;
  /** The next rails to try, in order, if this one fails. */
  fallbackChain: RailId[];
}

/** Rails a business can use for a given ticket size. Mirrors real-world limits. */
const SMALL_TICKET_MAX = 500;

function railAffinity(railId: RailId, amount: number, paymentScore: number): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (railId === 'square') {
    score += 40;
    if (amount <= SMALL_TICKET_MAX) {
      score += 25;
      reasons.push(`amount under $${SMALL_TICKET_MAX}`);
    } else {
      reasons.push(`amount over $${SMALL_TICKET_MAX} carries a higher card fee`);
      score -= 10;
    }
  } else if (railId === 'safepay') {
    score += 30;
    reasons.push('local card rail for the PKR market');
  } else if (railId === 'paypal') {
    score += 20;
    if (amount > SMALL_TICKET_MAX) {
      score += 15;
      reasons.push('better fit for larger tickets');
    }
  } else if (railId === 'solana') {
    score += 22;
    reasons.push('stablecoin settlement, no card fee');
    if (amount >= SMALL_TICKET_MAX) {
      score += 8;
      reasons.push('favoured on larger tickets');
    }
  } else if (railId === 'bank') {
    score += 10;
    reasons.push('no processing fee');
    if (paymentScore < 40) {
      score += 20;
      reasons.push('preferred for low-trust clients because funds clear before work is released');
    }
  }

  return { score, reasons };
}

function currencyMatches(railId: RailId, currency: string | null | undefined): boolean {
  if (!currency) return true;
  const curr = currency.toUpperCase();
  if (curr === 'PKR') return railId === 'safepay' || railId === 'bank' || railId === 'solana';
  // Everything non-PKR settles in fiat-major or USDC; Square/PayPal cover it.
  return railId !== 'safepay';
}

/**
 * Inputs to `selectRail` that are not on the invoice or the client row.
 *
 * Grouped because they arrive from different places and it matters which is
 * which. `passport` is the only source of a wallet address, because
 * `CrmClient` has no wallet column — it reaches `TrustPassport` through
 * `passportId`.
 */
export interface SelectRailContext {
  businessAddress?: string | null;
  /**
   * The client's trust passport. `walletAddress` is what makes Solana
   * reachable for this client; `verified` is what makes a PayPal payment
   * request sendable.
   */
  passport?: Pick<TrustPassport, 'paymentScore' | 'walletAddress' | 'verified'> | null;
  currency?: string | null;
  /**
   * Rails to skip. Used by the retry path so a retry does not land back on the
   * rail that just failed — the one thing a fallback chain is no good for if
   * the failing rail is still first in it.
   */
  excludeRails?: readonly RailId[];
  /**
   * Allow selecting a rail the business has no registered method for. Left
   * false by default, and set true only by callers that are diagnosing rather
   * than sending — a retry must never invent a payment link for a method that
   * does not exist.
   */
  allowUnregistered?: boolean;
}

/**
 * The invoice fields the router actually reads.
 *
 * Narrower than `Invoice` on purpose. The router needs an amount, a number for
 * logging, and nothing else; taking the full model meant every caller with a
 * partial row had to cast, and casts are how a caller ends up passing something
 * shaped like an invoice but missing the fields the router assumes. A real
 * `Invoice` satisfies this, so nothing that worked before stops working.
 */
export type RailInvoice = Pick<Invoice, 'id' | 'number' | 'subtotal' | 'clientId' | 'businessId'>;

/**
 * The client fields the router actually reads. Same reasoning as `RailInvoice`.
 */
export type RailClient = Pick<CrmClient, 'id' | 'name' | 'email' | 'address'>;

/** Build the eligibility context eligibility predicates are judged against. */
export function buildEligibilityContext(
  invoice: RailInvoice,
  client: RailClient,
  geo: ClientGeoHint,
  context: SelectRailContext,
): EligibilityContext {
  const amount = Number(invoice.subtotal ?? 0);
  return {
    amount,
    currency: context.currency ?? 'USD',
    countryCode: geo.countryCode,
    email: client.email,
    // `verified` is the passport's verification flag, not an email-specific
    // one — the schema has no per-email verification state. That is a
    // conflation and it is resolved conservatively: absent or null reads as
    // unverified, so PayPal is skipped rather than offered on a guess.
    emailVerified: context.passport?.verified === true,
    walletAddress: context.passport?.walletAddress ?? null,
  };
}

/**
 * Select the best payment method for an invoice and explain the choice.
 *
 * Ranking is a transparent weighted sum, not a black box: country affinity,
 * ticket size, the client's payment score, and the client's preferred currency
 * each contribute, and the winning factors become the human-readable reasoning.
 *
 * On top of that ranking sit two gates, in this order:
 *
 *   - Eligibility (`canHandle`) removes rails that cannot reach this payer.
 *   - Cost reorders rails that the ranking already considers equivalent.
 *
 * Both are subordinate to trust and geography, which stay the primary signal.
 * A cheap rail that the client cannot use is not cheap, it is unavailable, and
 * a cheaper rail never overrides a trust difference — see COST_TIEBREAK_BAND.
 */
export function selectRail(
  invoice: RailInvoice,
  client: RailClient,
  methods: PaymentMethod[],
  context: SelectRailContext = {},
): RailSelection {
  const paymentScore = normalisePaymentScore(context.passport?.paymentScore);
  const geo = resolveClientGeoHint(client.address, context.businessAddress);
  const eligibilityCtx = buildEligibilityContext(invoice, client, geo, context);

  const registered = methods.filter((m) => {
    if (!isRailId(m.railId)) return false;
    if (!paymentRails[m.railId]) return false;
    return paymentRails[m.railId].validateTarget(m.target);
  });

  const termsRecommendation = recommendTerms(paymentScore);

  if (registered.length === 0 && !context.allowUnregistered) {
    throw new Error('No usable payment method is registered for this business.');
  }

  const amount = Number(invoice.subtotal ?? 0);
  const currency = context.currency ?? 'USD';
  const excluded = new Set<RailId>(context.excludeRails ?? []);

  // A method row may list the same rail twice (two Square links, say). The
  // first wins, so cost and eligibility are computed once per rail and the
  // business's ordering preference is not the tie-break by accident.
  const byRail = new Map<RailId, PaymentMethod>();
  for (const m of registered) {
    const railId = m.railId as RailId;
    if (!byRail.has(railId)) byRail.set(railId, m);
  }


  // ── Gate 1: eligibility ────────────────────────────────────────────────────
  // Eligibility is a filter on the candidate set, not a score. A rail the
  // client cannot be reached on is removed outright, which is why it outranks
  // trust and cost rather than competing with them: a rail that cannot settle
  // is not a worse option, it is not an option.
  const chain = fallbackChainFor(eligibilityCtx);

  // Everything the business registered, minus what this client cannot use and
  // what has already had its turn. Only these are ever scored — which is what
  // guarantees an ineligible rail cannot be selected by a high score or a low
  // cost, however attractive it looks on paper.
  const rejectedRails: RailSelection['rejectedRails'] = [];
  const candidateIds = new Set<RailId>();
  for (const railId of byRail.keys()) {
    if (excluded.has(railId)) {
      rejectedRails.push({ railId, reason: 'already attempted and failed' });
      continue;
    }
    const verdict = canHandle(railId, eligibilityCtx);
    if (!verdict.eligible) {
      rejectedRails.push({ railId, reason: verdict.blocked?.reason ?? 'ineligible for this client' });
      continue;
    }
    candidateIds.add(railId);
  }

  if (candidateIds.size === 0) {
    const detail =
      rejectedRails.length > 0
        ? rejectedRails.map((r) => `${r.railId}: ${r.reason}`).join('; ')
        : 'the business has no payment methods registered';
    throw new Error(`No eligible payment rail for ${invoice.number}: ${detail}`);
  }

  // The rail the chain leads with, among the candidates.
  //
  // Built from the whole chain rather than by taking the first eligible rail
  // and then checking whether it was registered: that ordering would report
  // PayPal as the primary rail for a business that only has a Solana method —
  // eligible, never configured, never used — and would never consult the rest
  // of the chain at all.
  const orderedCandidates: RailId[] = [];
  for (const rail of chain) {
    if (!candidateIds.has(rail)) continue;
    if (!orderedCandidates.includes(rail)) orderedCandidates.push(rail);
  }
  const primaryRailId = orderedCandidates[0] ?? null;
  const chainIndex = new Map<RailId, number>(chain.map((r, i) => [r, i]));

  const scored: RailScore[] = [...candidateIds].map((railId) => {
    const m = byRail.get(railId) as PaymentMethod;
    const reasons: string[] = [];
    let { score, reasons: affinityReasons } = railAffinity(railId, amount, paymentScore);
    reasons.push(...affinityReasons);

    const geoIndex = geo.preferredRails.indexOf(railId);
    if (geoIndex === 0) {
      score += 45;
      reasons.push(`client is in ${geo.country}`);
    } else if (geoIndex > 0) {
      score += 20;
      reasons.push(`client is in ${geo.country}`);
    } else if (geo.preferredRails.length > 0) {
      reasons.push(`client is in ${geo.country}, which is not this rail's home market`);
    }

    if (currencyMatches(railId, currency)) {
      score += 12;
      if (geo.country && geo.preferredRails.includes(railId)) {
        reasons.push(`settles in the client's ${currency} currency`);
      }
    } else {
      score -= 60;
      reasons.push(`does not settle in ${currency}`);
    }

    if (paymentScore < 40 && (railId === 'bank' || railId === 'solana')) {
      score += 15;
      reasons.push(`client's ${paymentScore} payment score favours funds clearing before release`);
    }

    if (m.isDefault) {
      score += 8;
      reasons.push('set as the business default');
    }

    return { railId, score, reasons, estimatedCostUsd: estimateRailCost(railId, amount) };
  });

  scored.sort((a, b) => b.score - a.score || a.railId.localeCompare(b.railId));

  // ── Gate 2: cost, within a band ────────────────────────────────────────────
  // Applied last, and only to rails that score close enough to count as
  // equivalent. The band is what keeps this a tiebreaker — see
  // COST_TIEBREAK_BAND for why a literal equality test would be dead code.
  let finalists = scored;
  let costDecided = false;
  if (scored.length > 1) {
    const topScore = scored[0].score;
    const band = scored.filter(
      (s) => topScore - s.score <= COST_TIEBREAK_BAND && !NON_AUTOMATABLE_RAILS.has(s.railId),
    );
    if (band.length > 1) {
      const cheapest = [...band].sort(
        (a, b) => a.estimatedCostUsd - b.estimatedCostUsd || a.railId.localeCompare(b.railId),
      )[0];
      costDecided = cheapest.railId !== scored[0].railId;
      if (costDecided) {
        // Promoted, not appended: the winner is taken from the head of
        // `finalists`, so putting the cheapest rail last would compute the
        // right answer and then rank it below the one it beat.
        finalists = [cheapest, ...scored.filter((s) => s.railId !== cheapest.railId)];
      }
    }
  }

  // ── Choosing ───────────────────────────────────────────────────────────────
  // The top of the reordered list. Note this is NOT "the chain's first choice,
  // if registered" — that would silently discard the cost tiebreaker, since a
  // chain-first rail that happens to be in the band would always win and cost
  // would never once be consulted. The chain's job is to narrow the candidate
  // set and to explain the choice, not to have the final say.
  const winner = finalists[0];
  const winnerMethod = byRail.get(winner.railId);
  if (!winnerMethod) {
    // Unreachable: candidates are built from `byRail`, so every finalist has a
    // method. Asserted rather than cast because a silent undefined here would
    // become an undefined `method` on the selection and fail much later, in
    // whichever caller first dereferenced it.
    throw new Error(`Rail ${winner.railId} is a candidate but has no registered method.`);
  }

  // Reported when the rail the chain led with is not the one we settled on, so
  // a merchant watching their preferred method get passed over can tell why.
  let fellBackFrom: RailSelection['fellBackFrom'] = null;
  if (primaryRailId && primaryRailId !== winner.railId) {
    fellBackFrom = {
      railId: primaryRailId,
      priority: (chainIndex.get(primaryRailId) ?? 0) + 1,
      reason: costDecided
        ? `${paymentRails[primaryRailId]?.name ?? primaryRailId} costs more for this amount`
        : `${paymentRails[primaryRailId]?.name ?? primaryRailId} scored lower for this client`,
    };
  }

  const displayName = paymentRails[winner.railId]?.name ?? winner.railId;
  const geoClause = geo.country
    ? geo.source === 'client_address'
      ? `client is in ${geo.country}`
      : `business is in ${geo.country}`
    : 'client location unknown';
  const amountClause = amount <= SMALL_TICKET_MAX ? `amount under $${SMALL_TICKET_MAX}` : `amount over $${SMALL_TICKET_MAX}`;

  const clauses = [`${geoClause}, ${amountClause}, client payment score ${paymentScore}`];

  // The cost comparison belongs in the reasoning only when cost actually moved
  // the answer. A sentence about cost on every routing decision trains readers
  // to skip the field.
  if (costDecided) {
    const pricier = finalists
      .filter((s) => s.estimatedCostUsd > winner!.estimatedCostUsd)
      .sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd)[0];
    clauses.push(
      pricier
        ? `cheapest for this amount ($${winner.estimatedCostUsd.toFixed(2)} on ${displayName} vs $${pricier.estimatedCostUsd.toFixed(2)} on ${paymentRails[pricier.railId]?.name ?? pricier.railId})`
        : `cheapest for this amount ($${winner.estimatedCostUsd.toFixed(2)})`,
    );
  }

  if (fellBackFrom) {
    const fromName = paymentRails[fellBackFrom.railId]?.name ?? fellBackFrom.railId;
    clauses.push(`primary rail ${fromName} passed over — ${fellBackFrom.reason}`);
  }

  // Surface an eligibility rejection only when it was ahead of the winner in
  // the chain — that is, when it is the reason we settled where we did. A
  // rejected method sitting below the chosen rail changed nothing, and listing
  // it on every invoice would bury the signal that matters.
  const winnerIndex = chainIndex.get(winner.railId) ?? Number.MAX_SAFE_INTEGER;
  const blockingRejection = rejectedRails.find((r) => {
    const idx = chainIndex.get(r.railId);
    return idx !== undefined && idx < winnerIndex;
  });
  if (blockingRejection) {
    const rejectedName = paymentRails[blockingRejection.railId]?.name ?? blockingRejection.railId;
    clauses.push(`${rejectedName} not usable for this client (${blockingRejection.reason})`);
  }

  const reasoning = `Using ${displayName} — ${clauses.join('; ')}.`;

  const remainingChain = chain.filter((r) => r !== winner.railId && !excluded.has(r));

  logger.info(
    `[RailRouter] ${invoice.number} → ${winner.railId} (score ${winner.score}, ~$${winner.estimatedCostUsd.toFixed(2)})` +
      `${costDecided ? ' [cost decided]' : ''}` +
      `${fellBackFrom ? ` [fell back from ${fellBackFrom.railId}]` : ''}.` +
      ` ${reasoning} Runner-up: ${finalists[1]?.railId ?? 'none'}.`,
  );

  return {
    method: winnerMethod,
    reasoning,
    termsRecommendation,
    candidates: finalists.map((s) => ({
      railId: s.railId,
      displayName: paymentRails[s.railId]?.name ?? s.railId,
      score: s.score,
      estimatedCostUsd: s.estimatedCostUsd,
    })),
    paymentScore,
    clientCountry: geo.country,
    geoSource: geo.source,
    primaryRailId,
    fellBackFrom,
    rejectedRails,
    costDecided,
    estimatedCostUsd: winner.estimatedCostUsd,
    fallbackChain: remainingChain,
  };
}
