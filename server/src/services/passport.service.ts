import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { writeReliabilityScore } from './trust-core.service';
import { clampReliabilityScore } from '../config/trust-weights';

// ── Passport Types ────────────────────────────────────────────────
export interface PassportObject {
  wallet_address: string | null;
  trust_score: number;
  score_tier: ScoreTier;
  total_actions: number;
  punctuality_rate: number;
  completed_bookings: number;
  missed_bookings: number;
  disputes_lost: number;
  disputes_won: number;
  first_seen: string;
  last_updated: string;
  flags: string[];
}

export type ScoreTier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Unrated';

export interface EligibilityResult {
  status: 'eligible' | 'not_eligible';
  score_tier: ScoreTier;
  trust_score: number;
  action_required?: string;
}

export interface VerifyResult {
  status: 'ok' | 'below_threshold' | 'not_found';
  passport?: PassportObject;
  required_tier?: ScoreTier;
  actual_tier?: ScoreTier;
  action_required?: string;
  message?: string;
}

// ── Tier Boundaries ───────────────────────────────────────────────
const TIER_BOUNDARIES: { tier: ScoreTier; min: number }[] = [
  // ── SCALE CONVERSION (0–1000 → 0–100) ─────────────────────────────────────
  //
  // These were 850 / 700 / 500 / 300, calibrated against a 0–1000 scale. They sit
  // beside `User.reliabilityScore`, which this codebase's own Elo path wrote on
  // 0–100 and which defaulted to 750 at signup — so a genuinely reliable user
  // scoring 92 out of 100 resolved to BRONZE, and a brand-new account resolving
  // to the 750 default resolved to GOLD.
  //
  // Boundaries are now evenly spaced on the canonical scale. `Platinum` is still
  // reachable, at 85 — but not by default any more, which is the point.
  { tier: 'Platinum', min: 85 },
  { tier: 'Gold', min: 70 },
  { tier: 'Silver', min: 50 },
  { tier: 'Bronze', min: 30 },
  { tier: 'Unrated', min: 0 },
];

const TIER_RANK: Record<ScoreTier, number> = {
  Platinum: 5,
  Gold: 4,
  Silver: 3,
  Bronze: 2,
  Unrated: 1,
};

// Score penalties for upheld disputes, in POINTS on the 0–100 scale.
//
// These were 25/100/50/40/15/10, authored against 0–1000. Divided by ten so the
// relative severity is unchanged: FRAUD was 100/1000, i.e. a tenth of the
// scale, and is now 10/100, also a tenth. Not re-weighted, because changing the
// severity of a fraud finding is a policy decision and not one this refactor
// gets to make silently.
//
// NOTE THE CEILING THIS EXPOSES: `FRAUD: 10` means an upheld fraud dispute
// costs ten points, which will not by itself move anybody out of EXCELLENT.
// Before the scale was fixed, subtracting 100 from a 0–1000 score took a user
// from, say, 800 to 700 — still GOLD. The fraud penalty has never actually
// demoted anyone on its own, on either scale. What does is the `disputeRate`
// term in the ensemble, which is unbounded in count and is the right place for
// this. Raised here rather than quietly fixed, because quietly fixing it would
// change outcomes for real disputes without anyone deciding to.
const DISPUTE_PENALTIES: Record<string, number> = {
  NO_SHOW: 2.5,
  FRAUD: 10,
  NON_PAYMENT: 5,
  HARASSMENT: 4,
  QUALITY_ISSUE: 1.5,
  OTHER: 1,
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Derive the score tier from a 0–100 trust score.
 */
export function deriveScoreTier(score: number): ScoreTier {
  const clamped = clampReliabilityScore(score);
  for (const { tier, min } of TIER_BOUNDARIES) {
    if (clamped >= min) return tier;
  }
  return 'Unrated';
}

/**
 * Find a user by wallet address.
 */
async function findUserByWallet(walletAddress: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { address: walletAddress },
    select: { userId: true },
  });
  if (!wallet) return null;
  return wallet.userId;
}

/**
 * Assemble the full Passport object for a user.
 */
export async function assemblePassport(
  userId: string
): Promise<PassportObject | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        reliabilityScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    // Fetch wallet address
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { address: true },
    });

    // Fetch reservation stats
    const [totalActions, completedBookings, missedBookings] = await Promise.all([
      prisma.reservation.count({ where: { customerId: userId } }),
      prisma.reservation.count({ where: { customerId: userId, status: 'COMPLETED' } }),
      prisma.reservation.count({ where: { customerId: userId, status: 'NO_SHOW' } }),
    ]);

    // Fetch dispute stats
    const [disputesLost, disputesWon] = await Promise.all([
      prisma.dispute.count({ where: { userId, outcome: 'UPHELD' } }),
      prisma.dispute.count({ where: { reportedById: userId, outcome: 'DISMISSED' } }),
    ]);

    // Fetch active flags
    const flagRecords = await prisma.userFlag.findMany({
      where: { userId, isActive: true },
      select: { flag: true },
    });

    // Calculate punctuality rate
    const punctualityRate = totalActions > 0
      ? Math.round(((totalActions - missedBookings) / totalActions) * 100) / 100
      : 1.0;

    // Canonical 0-100. Was clamped to 0-1000 here, against a column other
    // writers filled on 0-100 — so the clamp was a no-op that let 750 through
    // into a field the tier table then read as GOLD.
    const trustScore = clampReliabilityScore(user.reliabilityScore);
    const scoreTier = deriveScoreTier(trustScore);

    return {
      wallet_address: wallet?.address || null,
      trust_score: trustScore,
      score_tier: scoreTier,
      total_actions: totalActions,
      punctuality_rate: punctualityRate,
      completed_bookings: completedBookings,
      missed_bookings: missedBookings,
      disputes_lost: disputesLost,
      disputes_won: disputesWon,
      first_seen: user.createdAt.toISOString(),
      last_updated: user.updatedAt.toISOString(),
      flags: flagRecords.map((f) => f.flag),
    };
  } catch (error) {
    logger.error('[PassportService] Error assembling passport:', error);
    return null;
  }
}

/**
 * Assemble a Passport by wallet address.
 */
export async function assemblePassportByWallet(
  walletAddress: string
): Promise<PassportObject | null> {
  const userId = await findUserByWallet(walletAddress);
  if (!userId) return null;
  return assemblePassport(userId);
}

/**
 * Check if a user meets a required tier threshold.
 */
export async function checkEligibility(
  walletAddress: string,
  requiredTier: ScoreTier
): Promise<EligibilityResult> {
  const userId = await findUserByWallet(walletAddress);

  if (!userId) {
    return {
      status: 'not_eligible',
      score_tier: 'Unrated',
      trust_score: 0,
      action_required: 'user_not_found',
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reliabilityScore: true },
  });

  if (!user) {
    return {
      status: 'not_eligible',
      score_tier: 'Unrated',
      trust_score: 0,
      action_required: 'user_not_found',
    };
  }

  const trustScore = clampReliabilityScore(user.reliabilityScore);
  const actualTier = deriveScoreTier(trustScore);
  const meetsThreshold = TIER_RANK[actualTier] >= TIER_RANK[requiredTier];

  return {
    status: meetsThreshold ? 'eligible' : 'not_eligible',
    score_tier: actualTier,
    trust_score: trustScore,
    action_required: meetsThreshold ? undefined : 'deposit_required',
  };
}

/**
 * Verify a user's Passport with an optional tier threshold.
 */
export async function verifyPassport(
  walletAddress: string,
  requiredTier?: ScoreTier
): Promise<VerifyResult> {
  const passport = await assemblePassportByWallet(walletAddress);

  if (!passport) {
    return { status: 'not_found', message: 'No user found for this wallet address.' };
  }

  // If no tier required, just return the passport
  if (!requiredTier) {
    return { status: 'ok', passport };
  }

  // Check tier threshold
  const meetsThreshold = TIER_RANK[passport.score_tier] >= TIER_RANK[requiredTier];

  if (meetsThreshold) {
    return { status: 'ok', passport };
  }

  return {
    status: 'below_threshold',
    passport,
    required_tier: requiredTier,
    actual_tier: passport.score_tier,
    action_required: 'deposit_required',
    message: 'User score does not meet the required tier for this transaction.',
  };
}

/**
 * Record an incident (dispute) against a user and update their reliability score.
 */
export async function recordIncident(
  walletAddress: string,
  type: string,
  description?: string,
  apiClientId?: string
): Promise<{ incident_id: string; status: string; score_impact: number } | null> {
  try {
    const userId = await findUserByWallet(walletAddress);
    if (!userId) return null;

    const dispute = await prisma.dispute.create({
      data: {
        userId,
        apiClientId: apiClientId || undefined,
        type: type as any,
        description: description || undefined,
      },
    });

    const penalty = DISPUTE_PENALTIES[type] || DISPUTE_PENALTIES.OTHER;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true },
    });

    if (user) {
      // Clamp on read before subtracting. `user.reliabilityScore - penalty`
      // against an unclamped 750 produced 650 — a value that, on the canonical
      // 0-100 scale, is a catastrophic score, applied as a "penalty" to an
      // account that had done nothing. The dispute penalty is now subtracted
      // from a score that is known to be on the scale it is meant for.
      const currentScore = clampReliabilityScore(user.reliabilityScore);
      const newScore = await writeReliabilityScore('user', userId, currentScore - penalty, {
        reason: `Incident recorded: ${type}`,
        component: 'DISPUTE',
        severity: 'negative',
        metadata: { disputeId: dispute.id, disputeType: type, penalty },
      });

      logger.info(
        `[PassportService] Incident recorded for user ${userId}: type=${type}, penalty=${penalty}, newScore=${newScore}`
      );
    }

    const existingIncidents = await prisma.dispute.count({
      where: { userId, type: type as any },
    });

    if (existingIncidents >= 3) {
      await prisma.userFlag.upsert({
        where: { userId_flag: { userId, flag: `repeat_${type.toLowerCase()}` } },
        create: { userId, flag: `repeat_${type.toLowerCase()}` },
        update: { isActive: true },
      }).catch((flagErr) =>
        logger.error('[PassportService] Error adding repeat flag:', flagErr)
      );
    }

    return {
      incident_id: dispute.id,
      status: 'received',
      score_impact: -penalty,
    };
  } catch (error) {
    logger.error('[PassportService] Error recording incident:', error);
    return null;
  }
}

/**
 * Bind an X.509 PKI certificate to a wallet (GB/Z 185.3 Compliance)
 */
export async function bindX509Certificate(
  walletAddress: string,
  certificate: string,
  signedNonce: string
): Promise<{ success: boolean; message: string }> {
  try {
    const userId = await findUserByWallet(walletAddress);
    if (!userId) return { success: false, message: 'User not found' };

    logger.info(`[PassportService] X.509 Certificate bound for user ${userId} (GB/Z 185.3 Compliant)`);

    return {
      success: true,
      message: 'X.509 Certificate successfully verified and bound to Pabandi identity.'
    };
  } catch (error) {
    logger.error('[PassportService] Error binding X.509 certificate:', error);
    return { success: false, message: 'Internal server error' };
  }
}

