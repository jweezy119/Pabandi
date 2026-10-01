import type { BusinessPaymentMethod, CrmClient, Invoice, TrustPassport } from '@prisma/client';
import { paymentRails } from '../payments/rails';
import { logger } from '../utils/logger';

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
 */

export const RAIL_IDS = ['square', 'solana', 'paypal', 'safepay', 'bank'] as const;
export type RailId = (typeof RAIL_IDS)[number];

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

const COUNTRY_HINTS: { match: RegExp; country: string; rails: RailId[] }[] = [
  { match: /\b(united states|usa|u\.s\.a?|united states of america)\b/i, country: 'United States', rails: ['square'] },
  { match: /\b(pakistan|pk|islamabad|karachi|lahore|peshawar)\b/i, country: 'Pakistan', rails: ['safepay'] },
  { match: /\b(united kingdom|uk|london|manchester)\b/i, country: 'United Kingdom', rails: [] },
  { match: /\b(pakistan)\b/i, country: 'Pakistan', rails: ['safepay'] },
  { match: /\b(canada|toronto|vancouver)\b/i, country: 'Canada', rails: ['square'] },
  { match: /\b(australia|sydney|melbourne)\b/i, country: 'Australia', rails: ['square'] },
  { match: /\b(uae|dubai|abu dhabi|emirates)\b/i, country: 'UAE', rails: [] },
  { match: /\b(germany|frankfurt|berlin|munich)\b/i, country: 'Germany', rails: [] },
  { match: /\b(saudi arabia|riyadh|jeddah)\b/i, country: 'Saudi Arabia', rails: [] },
  { match: /\b(india|delhi|mumbai|bangalore)\b/i, country: 'India', rails: [] },
];

export interface ClientGeoHint {
  country: string | null;
  source: 'client_address' | 'business_address' | 'unknown';
  /** Rails that settle natively in this country, most-preferred first. */
  preferredRails: RailId[];
}

export function resolveClientGeoHint(clientAddress: string | null | undefined, businessAddress?: string | null): ClientGeoHint {
  const fromClient = matchCountry(clientAddress);
  if (fromClient) return { ...fromClient, source: 'client_address' };

  const fromBusiness = matchCountry(businessAddress);
  if (fromBusiness) return { ...fromBusiness, source: 'business_address' };

  return { country: null, source: 'unknown', preferredRails: [] };
}

function matchCountry(address: string | null | undefined): { country: string; preferredRails: RailId[] } | null {
  if (!address || typeof address !== 'string') return null;
  for (const hint of COUNTRY_HINTS) {
    if (hint.match.test(address)) {
      return { country: hint.country, preferredRails: hint.rails };
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
}

export interface RailSelection {
  method: PaymentMethod;
  reasoning: string;
  termsRecommendation: TermsRecommendation;
  /** Ranked alternatives, best first. Useful for the UI and for logging. */
  candidates: { railId: RailId; displayName: string; score: number }[];
  paymentScore: number;
  clientCountry: string | null;
  geoSource: ClientGeoHint['source'];
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
 * Select the best payment method for an invoice and explain the choice.
 *
 * Ranking is a transparent weighted sum, not a black box: country affinity,
 * ticket size, the client's payment score, and the client's preferred currency
 * each contribute, and the winning factors become the human-readable reasoning.
 */
export function selectRail(
  invoice: Invoice,
  client: CrmClient,
  methods: PaymentMethod[],
  context: { businessAddress?: string | null; passport?: Pick<TrustPassport, 'paymentScore'> | null; currency?: string | null } = {},
): RailSelection {
  const paymentScore = normalisePaymentScore(context.passport?.paymentScore);
  const geo = resolveClientGeoHint(client.address, context.businessAddress);

  const usable = methods.filter((m) => {
    if (!isRailId(m.railId)) return false;
    if (!paymentRails[m.railId]) return false;
    return paymentRails[m.railId].validateTarget(m.target);
  });

  const termsRecommendation = recommendTerms(paymentScore);

  if (usable.length === 0) {
    throw new Error('No usable payment method is registered for this business.');
  }

  const amount = Number(invoice.subtotal ?? 0);
  const currency = context.currency ?? 'USD';

  const scored: RailScore[] = usable.map((m) => {
    const railId = m.railId as RailId;
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

    return { railId, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score || a.railId.localeCompare(b.railId));

  const winner = scored[0];
  const winningMethod = usable.find((m) => m.railId === winner.railId) as PaymentMethod;

  const displayName = paymentRails[winner.railId]?.name ?? winner.railId;
  const geoClause = geo.country
    ? geo.source === 'client_address'
      ? `client is in ${geo.country}`
      : `business is in ${geo.country}`
    : 'client location unknown';
  const amountClause = amount <= SMALL_TICKET_MAX ? `amount under $${SMALL_TICKET_MAX}` : `amount over $${SMALL_TICKET_MAX}`;

  const reasoning = `Using ${displayName} — ${geoClause}, ${amountClause}, client payment score ${paymentScore}.`;

  logger.info(
    `[RailRouter] ${invoice.number} → ${winner.railId} (score ${winner.score}). ${reasoning} Runner-up: ${scored[1]?.railId ?? 'none'}.`,
  );

  return {
    method: winningMethod,
    reasoning,
    termsRecommendation,
    candidates: scored.map((s) => ({
      railId: s.railId,
      displayName: paymentRails[s.railId]?.name ?? s.railId,
      score: s.score,
    })),
    paymentScore,
    clientCountry: geo.country,
    geoSource: geo.source,
  };
}
