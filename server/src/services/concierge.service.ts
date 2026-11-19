/**
 * concierge.service.ts — the AI Concierge behind the global chat widget.
 *
 * WHY THIS EXISTS
 * ---------------
 * `GlobalAIConciergeWidget` is mounted on every authenticated page and posts to
 * `/ai/concierge`. Until now no such route existed, so every message failed.
 * This service is the brain that was missing.
 *
 * WHAT IT DOES
 * ------------
 *  1. Classifies intent + language with the existing `aiNlpService` (real, and
 *     already used by WhatsApp) rather than inventing a second NLU path.
 *  2. Extracts booking entities (date / time / guests / occasion / cuisine) with
 *     a deterministic parser, because the proposal must carry real values the
 *     booking flow can consume — an LLM's free-text date is not bookable.
 *  3. Searches real businesses in Postgres and ranks them with a transparent
 *     score: text/category match, trust score, rating, and escrow-readiness.
 *     Ranking is explainable so the reply can justify the top pick.
 *  4. Writes a short, natural reply through the multi-provider AI router, with a
 *     deterministic fallback so the concierge never goes silent on an AI outage.
 *
 * NON-GOALS
 * ---------
 * It never creates a booking or moves money. It returns a *proposal*; the widget
 * deep-links into the normal booking flow, which re-validates price, slot, and
 * auth. The concierge is an advisor, not a transaction boundary.
 */

import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiNlpService } from './ai.nlp.service';
import { aiProviderRouter } from './ai/aiProvider.router';
import { formatBusinessDiscoveryItem, type FormattedBusinessDiscoveryItem } from '../utils/businessDiscovery';

export interface ConciergeRequest {
  query: string;
  walletAddress?: string;
  /** City bias from the user's profile/location, when known. */
  city?: string;
}

export interface ConciergeProposal {
  proposedBusinessId: string;
  businessName: string;
  businessSlug: string | null;
  category: string;
  city: string;
  reservationDate: string | null; // ISO yyyy-mm-dd, when a date was understood
  reservationTime: string | null; // HH:mm (24h), when a time was understood
  numberOfGuests: number | null;
  depositAmount: number;
  currency: string;
  escrowEnabled: boolean;
  trustBand: string;
  rating: number;
  reviewCount: number;
  /** 0..1, why the model surfaced this one. */
  matchScore: number;
  /** Human reasons, e.g. "Top rated", "Escrow protected". */
  reasons: string[];
}

export interface ConciergeResult {
  message: string;
  intent: string;
  language: string;
  proposal: ConciergeProposal | null;
  alternatives: Array<Pick<ConciergeProposal, 'proposedBusinessId' | 'businessName' | 'matchScore' | 'trustBand'>>;
  provider: string | null;
}

const MAX_QUERY_LENGTH = 500;

/* ── Entity extraction ──────────────────────────────────────────────────── */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface BookingEntities {
  date: string | null; // yyyy-mm-dd
  time: string | null; // HH:mm
  guests: number | null;
  occasion: string | null;
  categoryHint: string | null;
}

/**
 * Deterministic date resolution. The booking flow needs an absolute date, not
 * "Friday" — but "Friday" is exactly what a person types. We resolve relative
 * expressions against the server's "now" and keep the result honest: if the
 * weekday already passed this week, it rolls to next week.
 */
function resolveDate(query: string, now = new Date()): string | null {
  const q = query.toLowerCase();

  if (/\btoday\b/.test(q)) return toISODate(now);
  if (/\btomorrow\b/.test(q)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  }
  if (/\bday after tomorrow\b/.test(q)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return toISODate(d);
  }

  const weekdayMatch = q.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[1]);
    const current = now.getDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0) delta = 7; // "Friday" said on a Friday means next Friday
    const d = new Date(now);
    d.setDate(d.getDate() + delta);
    return toISODate(d);
  }

  // Explicit D/M or D/M/YYYY, e.g. "25/12", "25/12/2026"
  const numeric = q.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = parseInt(numeric[1], 10);
    const month = parseInt(numeric[2], 10) - 1;
    let year = numeric[3] ? parseInt(numeric[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime()) && d.getMonth() === month) return toISODate(d);
  }

  return null;
}

function resolveTime(query: string): string | null {
  const q = query.toLowerCase();

  // "7pm", "7 pm", "at 19:00", "19:30"
  const withMeridiem = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (withMeridiem) {
    let hour = parseInt(withMeridiem[1], 10) % 12;
    if (withMeridiem[3] === 'pm') hour += 12;
    const minute = withMeridiem[2] ? parseInt(withMeridiem[2], 10) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  // 24h "19:30"
  const military = q.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (military) {
    return `${military[1].padStart(2, '0')}:${military[2]}`;
  }

  return null;
}

function extractEntities(query: string): BookingEntities {
  const q = query.toLowerCase();

  const guestsMatch = q.match(/\b(\d{1,2})\s*(?:guests?|people|pax|persons?|covers?|of us)\b/);
  const guests = guestsMatch ? clampInt(guestsMatch[1], 1, 50) : null;

  const occasionMatch = q.match(/\b(birthday|anniversary|date night|date|business|corporate|honeymoon|celebration|dinner|lunch|brunch)\b/);
  const occasion = occasionMatch ? occasionMatch[1] : null;

  // Cuisine / category hint for ranking — only a nudge, never a hard filter.
  let categoryHint: string | null = null;
  const categoryMap: Array<[RegExp, string]> = [
    [/\b(italian|pizza|pasta)\b/, 'RESTAURANT'],
    [/\b(chinese|asian|sushi|thai)\b/, 'RESTAURANT'],
    [/\b(seafood|steak|grill|bbq|burger)\b/, 'RESTAURANT'],
    [/\b(breakfast|brunch)\b/, 'CAFE'],
    [/\b(coffee|cafe|café|espresso)\b/, 'CAFE'],
    [/\b(haircut|salon|barber|stylist)\b/, 'SALON'],
    [/\b(spa|massage|facial)\b/, 'SPA'],
    [/\b(gym|fitness|workout|trainer)\b/, 'FITNESS'],
    [/\b(dentist|dental|doctor|clinic|checkup)\b/, 'CLINIC'],
  ];
  for (const [pattern, category] of categoryMap) {
    if (pattern.test(q)) {
      categoryHint = category;
      break;
    }
  }

  return {
    date: resolveDate(query),
    time: resolveTime(query),
    guests,
    occasion,
    categoryHint,
  };
}

/* ── Discovery + ranking ────────────────────────────────────────────────── */

interface ScoredBusiness {
  business: FormattedBusinessDiscoveryItem;
  score: number;
  reasons: string[];
}

/**
 * Pull candidate businesses and score them.
 *
 * The score is deliberately additive and legible:
 *   - 0.45  trust (0..100 → 0..1) — Pabandi's core differentiator
 *   - 0.25  text/category match against the query
 *   - 0.20  rating (0..5 → 0..1)
 *   - 0.10  escrow readiness (deposit configured)
 * A category hint from the query multiplies the whole thing so an explicit
 * "Italian" still floats an Italian place above a marginally-higher-trust one.
 */
async function discoverAndRank(params: {
  query: string;
  city?: string;
  categoryHint: string | null;
  limit: number;
}): Promise<ScoredBusiness[]> {
  const where: any = { isActive: true };

  if (params.city) {
    where.OR = [
      { city: { contains: params.city, mode: 'insensitive' } },
      { state: { contains: params.city, mode: 'insensitive' } },
    ];
  }

  // Category is a ranking signal, not a filter: we fetch a broad candidate set
  // and let trust + match decide, so a great match is never hidden by a filter.
  const rows = await prisma.business.findMany({
    where,
    orderBy: [{ trustScore: 'desc' }, { rating: 'desc' }],
    take: Math.min(60, Math.max(params.limit * 4, 20)),
  });

  const queryTerms = tokenize(params.query);

  const scored: ScoredBusiness[] = rows.map((b) => {
    const business = formatBusinessDiscoveryItem(b);
    const reasons: string[] = [];

    const trust = clamp01((Number(b.trustScore ?? 70) || 70) / 100);
    const rating = clamp01((Number(b.rating ?? 0) || 0) / 5);
    const escrowReady = Boolean(b.depositAmount && b.depositAmount > 0) || Boolean(b.requireDeposit);

    let match = 0;
    const haystack = `${business.name} ${business.category} ${business.description ?? ''} ${business.city}`.toLowerCase();
    for (const term of queryTerms) {
      if (term.length >= 3 && haystack.includes(term)) match += 1;
    }
    match = clamp01(match / Math.max(3, queryTerms.length));

    let categoryBoost = 1;
    if (params.categoryHint && business.category === params.categoryHint) {
      categoryBoost = 1.25;
      reasons.push(`Matches ${humanizeCategory(params.categoryHint)}`);
    }

    if (Number(b.trustScore) >= 85) reasons.push('Elite trust');
    else if (Number(b.trustScore) >= 75) reasons.push('High trust');
    if (rating >= 0.9 && Number(b.reviewCount) > 0) reasons.push('Top rated');
    if (escrowReady) reasons.push('Escrow protected');
    if (Number(b.rating) >= 4.8) reasons.push('4.8+ rating');

    const base = 0.45 * trust + 0.25 * match + 0.2 * rating + 0.1 * (escrowReady ? 1 : 0);
    const score = clamp01(base * categoryBoost);

    return { business, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/* ── Proposal assembly ──────────────────────────────────────────────────── */

function buildProposal(scored: ScoredBusiness, entities: BookingEntities): ConciergeProposal {
  const b = scored.business;
  return {
    proposedBusinessId: b.id,
    businessName: b.name,
    businessSlug: b.slug ?? null,
    category: b.category,
    city: b.city,
    reservationDate: entities.date,
    reservationTime: entities.time,
    numberOfGuests: entities.guests,
    depositAmount: b.startingPrice,
    currency: 'USD',
    escrowEnabled: b.escrowEnabled,
    trustBand: b.trustBand,
    rating: b.rating,
    reviewCount: b.reviewCount,
    matchScore: Number(scored.score.toFixed(3)),
    reasons: scored.reasons.slice(0, 4),
  };
}

/* ── Reply generation ───────────────────────────────────────────────────── */

const CONCIERGE_SYSTEM = [
  'You are Pabandi\'s booking concierge. You help people find and reserve trusted local service businesses.',
  'Be warm, concise (max 3 short sentences), and concrete. Never invent businesses, prices, or availability.',
  'If a proposal is provided, present it as a suggestion the user can book, and mention it is escrow-protected when true.',
  'Do not use markdown headings or bullet lists. Plain conversational text only.',
].join(' ');

async function generateReply(params: {
  query: string;
  proposal: ConciergeProposal | null;
  alternatives: ConciergeResult['alternatives'];
  language: string;
  walletConnected: boolean;
}): Promise<{ text: string; provider: string | null }> {
  const contextLines: string[] = [];
  if (params.proposal) {
    const p = params.proposal;
    contextLines.push(`Suggested business: ${p.businessName} (${p.category}, ${p.city})`);
    contextLines.push(`Trust: ${p.trustBand}; Rating: ${p.rating} (${p.reviewCount} reviews); Deposit from: $${p.depositAmount}`);
    if (p.reservationDate) contextLines.push(`Date understood: ${p.reservationDate}`);
    if (p.reservationTime) contextLines.push(`Time understood: ${p.reservationTime}`);
    if (p.numberOfGuests) contextLines.push(`Guests: ${p.numberOfGuests}`);
    if (p.reasons.length) contextLines.push(`Why this one: ${p.reasons.join(', ')}`);
  } else {
    contextLines.push('No matching business was found. Suggest the user broaden their search or browse all providers.');
  }
  if (params.alternatives.length) {
    contextLines.push(`Alternatives: ${params.alternatives.map((a) => a.businessName).join(', ')}`);
  }
  if (params.walletConnected) {
    contextLines.push('The user has a connected Solana wallet; you may note escrow is on-chain and cashback may apply.');
  }
  contextLines.push(`Reply language: ${params.language}. Match it.`);

  const prompt = [
    `User said: "${params.query}"`,
    '',
    contextLines.join('\n'),
    '',
    'Write the concierge reply now.',
  ].join('\n');

  const routed = await aiProviderRouter.generateText(prompt, { system: CONCIERGE_SYSTEM });
  if (routed?.text) return { text: routed.text.trim(), provider: routed.provider };

  // Deterministic fallback — never silent.
  return { text: fallbackReply(params.proposal), provider: null };
}

function fallbackReply(proposal: ConciergeProposal | null): string {
  if (proposal) {
    const when = [proposal.reservationDate, proposal.reservationTime].filter(Boolean).join(' at ');
    const whenText = when ? ` for ${when}` : '';
    const guestsText = proposal.numberOfGuests ? ` for ${proposal.numberOfGuests}` : '';
    return (
      `I found ${proposal.businessName} (${proposal.category} in ${proposal.city})` +
      `${whenText}${guestsText}. It's ${proposal.trustBand.toLowerCase()} trust` +
      `${proposal.escrowEnabled ? ' with escrow protection' : ''}. You can book it in one step.`
    );
  }
  return "I couldn't find an exact match just yet. Try adding a city, a category (like 'salon' or 'Italian'), or browse all providers and I'll help you narrow it down.";
}

/* ── Public entrypoint ──────────────────────────────────────────────────── */

export async function runConcierge(req: ConciergeRequest): Promise<ConciergeResult> {
  const query = String(req.query ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) {
    return {
      message: 'Ask me to find or book a trusted service — e.g. "book a table for 2 on Friday at 7pm".',
      intent: 'general',
      language: 'en',
      proposal: null,
      alternatives: [],
      provider: null,
    };
  }

  const classification = await aiNlpService
    .classifyIntentAndLanguage(query)
    .catch(() => ({ intent: 'booking', language: 'en', sentiment: 'neutral', confidence: 0.5 }));
  const entities = extractEntities(query);

  const scored = await discoverAndRank({
    query,
    city: req.city,
    categoryHint: entities.categoryHint,
    limit: 5,
  });

  const top = scored[0] ?? null;
  const proposal = top ? buildProposal(top, entities) : null;
  const alternatives = scored.slice(1, 4).map((s) => ({
    proposedBusinessId: s.business.id,
    businessName: s.business.name,
    matchScore: Number(s.score.toFixed(3)),
    trustBand: s.business.trustBand,
  }));

  const { text, provider } = await generateReply({
    query,
    proposal,
    alternatives,
    language: classification.language || 'en',
    walletConnected: Boolean(req.walletAddress),
  });

  logger.info(
    `[Concierge] intent=${classification.intent} lang=${classification.language} candidates=${scored.length} proposal=${proposal?.businessName ?? 'none'} provider=${provider ?? 'fallback'}`,
  );

  return {
    message: text,
    intent: classification.intent,
    language: classification.language,
    proposal,
    alternatives,
    provider,
  };
}

/* ── Small helpers ──────────────────────────────────────────────────────── */

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clampInt(value: string, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'are', 'can', 'book', 'reserve',
  'table', 'want', 'need', 'please', 'find', 'some', 'that', 'this', 'have',
  'has', 'was', 'from', 'into', 'about', 'near', 'me', 'our', 'get', 'got',
]);

function humanizeCategory(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}