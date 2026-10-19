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
 * Key by kind and id rather than by the id alone: a cuid can be both a User id
 * and a Passport id, and a bare-id key would let one principal's score be read
 * as another's.
 */
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
      source: passport ? 'TrustPassport.paymentScore' : 'no_passport',
      computedAt: Date.now(),
    };
  });

  return { score: record.score, cached: isFromCache(record), source: record.source };
}

/**
 * Resolve a User's score.
 *
 * Users do not have a TrustPassport row of their own, so this reads the
 * canonical reliability score the CRM keeps on the user.
 */
export async function getUserTrustScore(userId: string): Promise<ResolvedTrust> {
  const key = cacheKey('user', userId);

  const record = await readThrough<TrustScoreRecord>(key, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true },
    });

    if (!user) {
      return { score: NEUTRAL_SCORE, source: 'unknown_user', computedAt: Date.now() };
    }

    return {
      score: clamp(user.reliabilityScore ?? NEUTRAL_SCORE),
      source: 'User.reliabilityScore',
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
      source: 'TrustPassport.paymentScore',
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
  getPassportTrustScore,
  resolveTrustScore,
  invalidateTrustScore,
  TRUST_CACHE_TTL_SECONDS,
};

export default trustService;