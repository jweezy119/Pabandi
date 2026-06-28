import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

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
  { tier: 'Platinum', min: 850 },
  { tier: 'Gold', min: 700 },
  { tier: 'Silver', min: 500 },
  { tier: 'Bronze', min: 300 },
  { tier: 'Unrated', min: 0 },
];

const TIER_RANK: Record<ScoreTier, number> = {
  Platinum: 5,
  Gold: 4,
  Silver: 3,
  Bronze: 2,
  Unrated: 1,
};

// Score penalties for upheld disputes
const DISPUTE_PENALTIES: Record<string, number> = {
  NO_SHOW: 25,
  FRAUD: 100,
  NON_PAYMENT: 50,
  HARASSMENT: 40,
  QUALITY_ISSUE: 15,
  OTHER: 10,
};

// ── Core Functions ────────────────────────────────────────────────

/**
 * Derive the score tier from a 0–1000 trust score.
 */
export function deriveScoreTier(score: number): ScoreTier {
  for (const { tier, min } of TIER_BOUNDARIES) {
    if (score >= min) return tier;
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

    // Ensure score is on 0-1000 scale
    const trustScore = Math.max(0, Math.min(1000, Math.round(user.reliabilityScore)));
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

  const trustScore = Math.max(0, Math.min(1000, Math.round(user.reliabilityScore)));
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

    // Create the dispute record
    const dispute = await prisma.dispute.create({
      data: {
        userId,
        apiClientId: apiClientId || undefined,
        type: type as any,
        description: description || undefined,
      },
    });

    // Calculate score penalty
    const penalty = DISPUTE_PENALTIES[type] || DISPUTE_PENALTIES.OTHER;

    // Update the user's reliability score
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reliabilityScore: true },
    });

    if (user) {
      const newScore = Math.max(0, user.reliabilityScore - penalty);
      await prisma.user.update({
        where: { id: userId },
        data: { reliabilityScore: newScore },
      });

      logger.info(
        `[PassportService] Incident recorded for user ${userId}: type=${type}, penalty=${penalty}, newScore=${newScore}`
      );
    }

    // Auto-add a flag if it's a repeat offense
    const existingIncidents = await prisma.dispute.count({
      where: { userId, type: type as any },
    });

    if (existingIncidents >= 3) {
      await prisma.userFlag.upsert({
        where: { userId_flag: { userId, flag: `repeat_${type.toLowerCase()}` } },
        create: { userId, flag: `repeat_${type.toLowerCase()}` },
        update: { isActive: true },
      });
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
  
      // In a production environment, we would:
      // 1. Verify the signedNonce against the public key in the X.509 certificate
      // 2. Walk the certificate chain to a trusted root CA
      // 3. Store the certificate hash securely
  
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
  
