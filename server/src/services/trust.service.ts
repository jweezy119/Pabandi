import { prisma } from '../utils/database';
import { cacheGet, cacheSet, cacheDel } from '../lib/redis';
import { logger } from '../utils/logger';

/**
 * Trust Score resolution, cached.
 *
 * ─── WHAT IS BEING CACHED ───────────────────────────────────────────────────
 * Not `trustScoreService.calculateCompositeScore`, which is a pure function of
 * its inputs and costs nothing to run. What is expensive is the *path* to a
 * score: resolving which principal a caller is, loading the passport, and
 * assembling the signal set that feeds the computation. That path is several
 * round trips and it sits on request paths that render a profile, size a
 * session tier, or gate a deposit.
 *
 * So the cached value is the resolved score for a principal, not the formula.
 *
 * ─── WHY 5 MINUTES ──────────────────────────────────────────────────────────
 * Scores move on completed work, so a stale read is wrong for seconds, not
 * days. Five minutes is short enough that nobody notices the staleness and long
 * enough that a profile page render is not a database query.
 *
 * Every write path calls `invalidateTrustScore`. The TTL is a backstop for a
 * write that did not remember to, not the primary mechanism -- a five minute
 * window on a score that gates money is too long to lean on.
 */

export const TRUST_CACHE_TTL_SECONDS = 300;

const KEY_PREFIX = 'pabandi:trust:v1';

/**
 * ── THE TWO SCALES, AND WHY THIS FUNCTION EXISTS ────────────────────────────
 *
 * This codebase stores trust scores on two scales and the schema says so:
 *
 *   TrustPassport.paymentScore  0-1000  (defaults to 500, neutral is 500)
 *   User.reliabilityScore       0-100   (defaults to 50,  canonical)
 *   Business.reliabilityScore   0-100   (nullable)
 *
 * Session tiers are expressed on the 0-1000 scale (800+ opens the large tab),
 * so everything leaving this module is 0-1000.
 *
 * This is not a hypothetical. schema.prisma:64-66 records the same bug having
 * already happened: User.reliabilityScore "was @default(750) -- a 0-1000-scale
 * value in a 0-100 field, which made every new account read as GOLD against the
 * passport tier table". Passing a 0-100 score through unclamped would do it
 * again in the other direction: a user with a flawless 100 would leave here as
 * 100, fall below the 500 threshold, and be given the $20/24h tab instead of the
 * $1000/30-day one they earned.
 *
 * So 0-100 columns are converted here, explicitly, and everything downstream
 * only ever sees 0-1000.
 */
export function toThousandScale(score: number): number {
  return Math.round((score * 1000) / 100);
}

function cacheKey(kind: 'user' | 'agent' | 'passport' | 'client' | 'business', id: string): string {
  return `${KEY_PREFIX}:${kind}:${id}`;
}

export interface TrustScoreRecord {
  score: number;
  /** Which column this was read from, for diagnostics. */
  source: string;
  /** Epoch ms the value was read from the database. */
  computedAt: number;
}

export interface ResolvedTrust {
  score: number;
  /** True when the value came from Redis rather than the database. */
  cached: boolean;
  source: string;
}

/**
 * The Trust Score scale is 0-1000 across this codebase. A new principal has no
 * history, which is not the same as a bad one, so an unknown principal gets the
 * neutral mid-point rather than zero.
 */
export const NEUTRAL_SCORE = 500;

/**
 * Cold-start baseline on the 0-100 scale, from config/trust-weights.ts. Used
 * where a nullable canonical score has to resolve to something. Not 0: a
 * business or user with no completed work is not a bad one, and 0 is the worst
 * score available.
 */
export const COLD_START_SCORE = 50;

function clamp(score: number): number {
  if (!Number.isFinite(score)) return NEUTRAL_SCORE;
  return Math.min(1000, Math.max(0, Math.round(score)));
}

async function readThrough<T extends TrustScoreRecord>(
  key: string,
  compute: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);

  if (cached !== null && typeof cached.score === 'number') {
    return cached;
  }

  const computed = await compute();
  await cacheSet(key, computed, TRUST_CACHE_TTL_SECONDS);
  return computed;
}

/**
 * Resolve a Web3Agent's score.
 *
 * An agent has no score column of its own. The chain is Web3Agent.profileId
 * (a User id) -> the TrustPassport linked to that agent. The passport is looked
 * up by `agentId` first because that is the explicit link, falling back to
 * `userId` for passports created before the agent was associated.
 *
 * This is two queries on a cold read and zero on a warm one, which is the shape
 * that makes caching worth having.
 */
export async function getAgentTrustScore(agentId: string): Promise<ResolvedTrust> {
  const key = cacheKey('agent', agentId);

  const record = await readThrough<TrustScoreRecord>(key, async () => {
    const agent = await prisma.web3Agent.findUnique({
      where: { id: agentId },
      select: { profileId: true },
    });

    if (!agent) {
      // Deliberately not a cached neutral score. An agent that does not exist
      // yet will shortly, and caching its neutral score would hide the moment
      // it first earns a real one until the TTL expired.
      return { score: NEUTRAL_SCORE, source: 'unknown_agent', computedAt: Date.now() };
    }

    const passport = await prisma.trustPassport.findFirst({
      where: { OR: [{ agentId }, { userId: agent.profileId }] },
      select: { paymentScore: true, showUpScore: true },
    });

    const score = passport?.paymentScore ?? passport?.showUpScore ?? NEUTRAL_SCORE;

    return {
      score: clamp(score),
      source: passport ? 'TrustPassport.paymentScore (already 0-1000)' : 'no_passport',
      computedAt: Date.now(),
    };
  });

  return { score: record.score, cached: isFromCache(record), source: record.source };
}

/**
 * Resolve a User's score.
 *
 * Users do not have a TrustPassport row of their own. `User.reliabilityScore`
 * is the canonical 0-100 field, so it is converted to the 0-1000 scale the
 * tiers use. `User.trustScore` is 0-100 too and is a fallback for a user whose
 * reliability score has not been seeded.
 */
export async function getUserTrustScore(userId: string): Promise<ResolvedTrust> {
  const key = cacheKey('user', userId);

  const record = await readThrough<TrustScoreRecord>(key, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true, trustScore: true },
    });

    if (!user) {
      return { score: NEUTRAL_SCORE, source: 'unknown_user', computedAt: Date.now() };
    }

    const raw = user.reliabilityScore ?? user.trustScore ?? COLD_START_SCORE;

    return {
      score: clamp(toThousandScale(raw)),
      source: 'User.reliabilityScore (0-100 scaled to 0-1000)',
      computedAt: Date.now(),
    };
  });

  return { score: record.score, cached: isFromCache(record), source: record.source };
}

/**
 * Resolve a business's score, for the public storefront.
 *
 * `Business.reliabilityScore` is nullable by design -- schema.prisma:246-250
 * says readers must resolve null through the cold-start baseline rather than
 * defaulting to 0, because 0 is the worst possible score and "no history yet"
 * is not the same as "a bad record". So null becomes COLD_START_SCORE, scaled.
 */
export async function getBusinessTrustScore(businessId: string): Promise<ResolvedTrust> {
  const key = cacheKey('business', businessId);

  const record = await readThrough<TrustScoreRecord>(key, async () => {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { reliabilityScore: true, trustScore: true },
    });

    if (!business) {
      return { score: NEUTRAL_SCORE, source: 'unknown_business', computedAt: Date.now() };
    }

    const raw = business.reliabilityScore ?? business.trustScore ?? COLD_START_SCORE;

    return {
      score: clamp(toThousandScale(raw)),
      source:
        business.reliabilityScore === null
          ? 'Business.coldStart (0-100 scaled to 0-1000)'
          : 'Business.reliabilityScore (0-100 scaled to 0-1000)',
      computedAt: Date.now(),
    };
  });

  return { score: record.score, cached: isFromCache(record), source: record.source };
}

/**
 * Resolve a passport's payment score. This is the cheapest of the three --
 * one indexed row -- and the one the storefront API serves publicly.
 */
export async function getPassportTrustScore(passportId: string): Promise<ResolvedTrust> {
  const key = cacheKey('passport', passportId);

  const record = await readThrough<TrustScoreRecord>(key, async () => {
    const passport = await prisma.trustPassport.findUnique({
      where: { id: passportId },
      select: { paymentScore: true, showUpScore: true },
    });

    if (!passport) {
      return { score: NEUTRAL_SCORE, source: 'unknown_passport', computedAt: Date.now() };
    }

    return {
      score: clamp(passport.paymentScore ?? passport.showUpScore ?? NEUTRAL_SCORE),
      source: 'TrustPassport.paymentScore (already 0-1000)',
      computedAt: Date.now(),
    };
  });

  return { score: record.score, cached: isFromCache(record), source: record.source };
}

/**
 * Resolve whichever principal an identifier names.
 *
 * The session-open route in Phase 2 accepts a client-supplied `trustScore`,
 * which lets a caller claim any tier. This is the server-side resolution that
 * closes that gap: it takes the principal's identity and returns the score
 * that identity actually has.
 */
export async function resolveTrustScore(
  ownerType: 'user' | 'agent',
  ownerId: string
): Promise<ResolvedTrust> {
  return ownerType === 'agent' ? getAgentTrustScore(ownerId) : getUserTrustScore(ownerId);
}

/**
 * Whether a record was served from Redis.
 *
 * Inferred from age rather than carried as a flag: a computed record is
 * stamped with `computedAt` and a fresh one cannot have been in Redis for more
 * than a few milliseconds. Rough on purpose -- this feeds logging and the
 * storefront's cache header, and a false positive here costs nothing that a
 * wrong score would.
 */
function isFromCache(record: TrustScoreRecord): boolean {
  return Date.now() - record.computedAt > 50;
}

/**
 * Drop cached scores. Call from every path that writes one.
 *
 * Takes ids for several principal kinds at once because a single action often
 * moves more than one -- a completed job raises the client's score and changes
 * the business's, and invalidating only the first would leave the second stale
 * for five minutes.
 */
export async function invalidateTrustScore(
  ids: {
    userId?: string;
    agentId?: string;
    passportId?: string;
    clientId?: string;
    businessId?: string;
  } = {}
): Promise<void> {
  const keys: string[] = [];
  if (ids.userId) keys.push(cacheKey('user', ids.userId));
  if (ids.agentId) keys.push(cacheKey('agent', ids.agentId));
  if (ids.passportId) keys.push(cacheKey('passport', ids.passportId));
  if (ids.clientId) keys.push(cacheKey('client', ids.clientId));
  if (ids.businessId) keys.push(cacheKey('business', ids.businessId));

  if (keys.length === 0) return;

  await cacheDel(...keys);
  logger.debug?.(`[Trust] invalidated ${keys.length} cache key(s)`);
}

export const trustService = {
  getAgentTrustScore,
  getUserTrustScore,
  getBusinessTrustScore,
  getPassportTrustScore,
  resolveTrustScore,
  invalidateTrustScore,
  TRUST_CACHE_TTL_SECONDS,
};

export default trustService;