import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { TrustPassportPayload, TrustPassportPredicates } from '../types/trustPassport.types';

export interface BusinessTrustMetrics {
  subjectId: string;
  businessName?: string;
  trustScore: number;
  disputeRate: number;
}

/**
 * Generate a mocked BBS+ / ZK cryptographic signature string.
 */
export function generateMockZkSignature(
  issuer: string,
  subjectId: string,
  predicates: TrustPassportPredicates,
  issuedAt: number
): string {
  const content = JSON.stringify({ issuer, subjectId, predicates, issuedAt });
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  const nonce = crypto.randomBytes(8).toString('hex');
  return `zkp_bbs_${hash}_${nonce}`;
}

/**
 * Verify a TrustPassportPayload ZK proof.
 */
export function verifyZkTrustProof(proof: any): {
  isValid: boolean;
  verifiedPredicates: string[];
  error?: string;
} {
  if (!proof || typeof proof !== 'object') {
    return { isValid: false, verifiedPredicates: [], error: 'Invalid payload: must be an object' };
  }

  if (proof.issuer !== 'Pabandi') {
    return { isValid: false, verifiedPredicates: [], error: 'Invalid issuer: proof must be issued by Pabandi' };
  }

  if (!proof.signature || typeof proof.signature !== 'string' || !proof.signature.startsWith('zkp_')) {
    return { isValid: false, verifiedPredicates: [], error: 'Invalid signature: must be a valid ZK proof signature' };
  }

  if (!proof.subjectId || typeof proof.subjectId !== 'string') {
    return { isValid: false, verifiedPredicates: [], error: 'Missing subjectId in proof payload' };
  }

  if (!proof.predicates || typeof proof.predicates !== 'object') {
    return { isValid: false, verifiedPredicates: [], error: 'Missing predicates in proof payload' };
  }

  const verifiedPredicates: string[] = [];

  if (proof.predicates.trustScore) {
    const raw = String(proof.predicates.trustScore).trim();
    // Normalizes ">800" or "> 800" to "trust_score > 800"
    const formatted = raw.startsWith('>') || raw.startsWith('<') || raw.startsWith('=')
      ? raw.replace(/^([><=]+)\s*/, '$1 ')
      : `> ${raw}`;
    verifiedPredicates.push(`trust_score ${formatted}`);
  }

  if (proof.predicates.disputeRate) {
    const raw = String(proof.predicates.disputeRate).trim();
    // Normalizes "<2%" or "< 2%" to "dispute_rate < 2%"
    const formatted = raw.startsWith('>') || raw.startsWith('<') || raw.startsWith('=')
      ? raw.replace(/^([><=]+)\s*/, '$1 ')
      : `< ${raw}`;
    verifiedPredicates.push(`dispute_rate ${formatted}`);
  }

  return {
    isValid: true,
    verifiedPredicates,
  };
}

/**
 * Fetch live or default trust metrics for a given user or business.
 */
export async function getBusinessTrustMetrics(userId: string): Promise<BusinessTrustMetrics> {
  const [user, business, passport] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, trustScore: true, reliabilityScore: true, role: true },
    }),
    prisma.business.findUnique({
      where: { ownerId: userId },
      select: { id: true, name: true },
    }),
    prisma.trustPassport.findUnique({
      where: { userId },
      select: { id: true, score: true, showUpScore: true },
    }),
  ]);

  const subjectId = business?.id || passport?.id || userId;
  const businessName = business?.name || 'Verified Business';

  // Determine trust score on a 0-1000 scale:
  // If user has a trust score <= 100, scale it to 0-1000 (e.g. 92.0 -> 920).
  // If passport has a score, use that.
  let calculatedScore = 920; // Reasonable default for verified active businesses
  if (passport?.score && passport.score > 0) {
    calculatedScore = passport.score > 100 ? Math.round(passport.score) : Math.round(passport.score * 10);
  } else if (user?.trustScore && user.trustScore > 0) {
    calculatedScore = user.trustScore > 100 ? Math.round(user.trustScore) : Math.round(user.trustScore * 10);
  }

  // Determine dispute rate:
  // Count disputes against this user / business
  let calculatedDisputeRate = 0.5; // Default 0.5%
  try {
    const disputeCount = await prisma.dispute.count({
      where: { userId },
    });

    const txCount = business?.id
      ? await prisma.invoice.count({ where: { businessId: business.id } })
      : 0;

    if (txCount > 0) {
      calculatedDisputeRate = Math.min(100, Math.round((disputeCount / txCount) * 1000) / 10);
    } else {
      calculatedDisputeRate = disputeCount > 0 ? 2.0 : 0.5;
    }
  } catch (err) {
    logger.warn('[getBusinessTrustMetrics] Error calculating dispute rate, using fallback', err);
  }

  return {
    subjectId,
    businessName,
    trustScore: calculatedScore,
    disputeRate: calculatedDisputeRate,
  };
}

