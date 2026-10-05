import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { blockchainService } from './blockchain.service';
import { dashscopeService } from './ai/dashscope.service';
import { readReliabilityScore } from './trust-core.service';
import {
  REFERRAL_GRAPH_TRUST,
  clampReliabilityScore,
  normalizeReliabilityScore,
  reliabilityTier,
} from '../config/trust-weights';

// ─── Platform boost weights ───────────────────────────────────────────────────
const PLATFORM_BOOST: Record<string, { base: number; maxBoost: number }> = {
  LINKEDIN:   { base: 2, maxBoost: 5 },
  X_TWITTER:  { base: 1, maxBoost: 3 },
  WHATSAPP:   { base: 2, maxBoost: 4 },
  TIKTOK:     { base: 1, maxBoost: 3 },
  INSTAGRAM:  { base: 2, maxBoost: 4 },
  FACEBOOK:   { base: 2, maxBoost: 4 },
  FIVERR:     { base: 4, maxBoost: 8 },
  UPWORK:     { base: 4, maxBoost: 8 },
};

export interface BadgePayload {
  pseudonymousId: string;
  tier: 'EXCELLENT' | 'AVERAGE' | 'RISKY';
  reliabilityScore: number;
  commerceScore: number;
  hospitalityScore: number;
  appointmentScore: number;
  freelanceScore: number;
  attendanceRate: number;
  totalBookings: number;
  completedBookings: number;
  socialSignals: string[];
  /**
   * The score as it is stored, before the social/graph adjustments below.
   *
   * Existed implicitly before and not at all on the wire: the badge published a
   * number that could not be reproduced from the API's own `/reliability`, and
   * nobody could tell which one was authoritative. Now the badge is a view, and
   * this is the underlying value, so the two can be reconciled by hand.
   */
  baseReliabilityScore: number;
  badges: string[];
  socialTrustBoost: number;
  graphTrustBoost?: number;
  verifiedAt: string;
  signedHash: string;
}

export interface SocialTrustBoostResult {
  totalBoost: number;
  breakdown: Record<string, number>;
}

export class BadgeService {
  /**
   * Generate a deterministic, privacy-preserving pseudonymous ID
   * from a real user ID. Salted with a server secret so it's never guessable.
   */
  generatePseudonymousId(userId: string): string {
    const salt = process.env.BADGE_SALT || process.env.JWT_SECRET || 'pabandi_badge_salt_v1';
    return crypto.createHmac('sha256', salt).update(userId).digest('hex').slice(0, 32);
  }

  /**
   * Reverse-lookup: find userId from a pseudonymousId.
   * Required for the public badge endpoint — we must scan all users.
   * In production, store the mapping in a dedicated encrypted table.
   */
  async resolveUserFromPseudonymousId(pseudonymousId: string): Promise<string | null> {
    try {
      // Fetch only IDs, generate pseudonymous IDs client-side, find match
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        if (this.generatePseudonymousId(user.id) === pseudonymousId) {
          return user.id;
        }
      }
      return null;
    } catch (error) {
      logger.error('Error resolving pseudonymous ID:', error);
      return null;
    }
  }

  /**
   * Compute social trust boost from a user's linked SocialIdentity records.
   */
  computeSocialTrustBoost(identities: any[]): SocialTrustBoostResult {
    const breakdown: Record<string, number> = {};
    let totalBoost = 0;

    for (const identity of identities) {
      const config = PLATFORM_BOOST[identity.platform];
      if (!config) continue;

      let boost = config.base;

      // LinkedIn-specific bonuses
      if (identity.platform === 'LINKEDIN') {
        if (identity.isVerified) boost += 1;
        if (identity.completeness && identity.completeness >= 0.9) boost += 1;
        if (identity.accountAgeDays && identity.accountAgeDays > 365 * 3) boost += 1;
      }

      // Meta ecosystem bonuses (WhatsApp, Instagram, Facebook)
      if (['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'].includes(identity.platform)) {
        if (identity.isVerified) boost += 1;
        if (identity.accountAgeDays && identity.accountAgeDays > 365 * 2) boost += 1;
      }

      // X (Twitter) bonuses
      if (identity.platform === 'X_TWITTER') {
        if (identity.isVerified) boost += 1;
        if (identity.accountAgeDays && identity.accountAgeDays > 365) boost += 1;
      }

      // TikTok bonuses
      if (identity.platform === 'TIKTOK') {
        if (identity.isVerified) boost += 1;
        if (identity.accountAgeDays && identity.accountAgeDays > 365) boost += 1;
      }

      // Fiverr / Upwork bonuses
      if (['FIVERR', 'UPWORK'].includes(identity.platform)) {
        if (identity.rating && identity.rating >= 4.8) boost += 2;
        if (identity.completionRate && identity.completionRate >= 0.95) boost += 2;
        if (identity.accountAgeDays && identity.accountAgeDays > 365 * 2) boost += 1;
      }

      // Cap at platform max
      boost = Math.min(boost, config.maxBoost);
      breakdown[identity.platform] = boost;
      totalBoost += boost;
    }

    return { totalBoost: Math.round(totalBoost * 10) / 10, breakdown };
  }

  /**
   * Compute the full badge status for a user.
   */
  async computeBadgeStatus(userId: string): Promise<BadgePayload> {
    const [user, stats, identities] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { 
          reliabilityScore: true,
          commerceScore: true,
          hospitalityScore: true,
          appointmentScore: true,
          freelanceScore: true,
          referredBy: {
            select: { id: true, reliabilityScore: true }
          }
        },
      }),
      prisma.reservation.groupBy({
        by: ['status'],
        where: { customerId: userId },
        _count: { id: true },
      }),
      prisma.socialIdentity.findMany({ where: { userId } }),
    ]);

    if (!user) throw new Error('User not found');

    const totalBookings = stats.reduce((s, r) => s + r._count.id, 0);
    const completed = stats.find(s => s.status === 'COMPLETED')?._count.id ?? 0;
    const noShows = stats.find(s => s.status === 'NO_SHOW')?._count.id ?? 0;
    const attended = totalBookings - noShows;
    const attendanceRate = totalBookings > 0 ? Math.round((attended / totalBookings) * 100) : 100;

    const { totalBoost } = this.computeSocialTrustBoost(identities);

    // Calculate Graph Trust Bonus / Penalty
    //
    // Thresholds read off `REFERRAL_GRAPH_TRUST` rather than inlined. The
    // referrer's own score is clamped first, because the column still holds
    // 750s for anyone who signed up before the cold-start fix, and `750 >= 90`
    // would hand every legacy account the bonus.
    let graphTrustBoost = 0;
    if (user.referredBy) {
      const referrerScore = clampReliabilityScore(user.referredBy.reliabilityScore);
      if (referrerScore >= REFERRAL_GRAPH_TRUST.HIGH_REFERRER_THRESHOLD) {
        graphTrustBoost = REFERRAL_GRAPH_TRUST.HIGH_REFERRER_BONUS;
      } else if (referrerScore < REFERRAL_GRAPH_TRUST.LOW_REFERRER_THRESHOLD) {
        graphTrustBoost = -REFERRAL_GRAPH_TRUST.LOW_REFERRER_PENALTY;
      }
    }

    // Effective reliability score with social and graph boost (capped at 100, min 0)
    //
    // ─── THE PUBLIC MISREPRESENTATION THIS FIXES ─────────────────────────────
    //
    // This used to read `user.reliabilityScore` straight off the row. That
    // column's default is 750, so a brand-new account — which had never booked
    // anything — computed `Math.round(750 + boost)`, clamped to 100, and every
    // share card went out reading:
    //
    //     "Another on-time arrival. Reliability score: 100/100."
    //
    // for someone with zero arrivals. The "another on-time arrival" is the part
    // that makes it a misrepresentation rather than a rounding bug: the string
    // asserts a history that does not exist.
    //
    // The read now goes through `readReliabilityScore`, which clamps to the
    // canonical 0–100 scale. Combined with the signup fix (a new account starts
    // at 50, not 750), the same card now reads "50/100" for a new account,
    // which is true.
    const baseScore = await readReliabilityScore('user', userId);

    let effectiveScore = normalizeReliabilityScore(
      baseScore + totalBoost + graphTrustBoost,
    );
    effectiveScore = clampReliabilityScore(effectiveScore);
    const tier = reliabilityTier(effectiveScore);

    // Dynamic badge list
    const badges: string[] = [];
    if (completed >= 1) badges.push('First Booking');
    if (completed >= 5) badges.push('5-Booking Streak');
    if (completed >= 10) badges.push('Star Patron');
    if (noShows === 0 && totalBookings >= 3) badges.push('Perfect Record');
    if (identities.find(i => i.platform === 'LINKEDIN') && completed >= 10) badges.push('LinkedIn Luminary');
    const metaPlatforms = identities.filter(i => ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'].includes(i.platform));
    if (metaPlatforms.length >= 3) {
      badges.push('Meta Verified');
    }
    if (metaPlatforms.length >= 2 && identities.find(i => i.platform === 'LINKEDIN') && attendanceRate >= 90) {
      badges.push('Cross-Platform Trusted');
    }

    const pseudonymousId = this.generatePseudonymousId(userId);
    const verifiedAt = new Date().toISOString();

    // Sign the payload for tamper-evidence
    const payloadStr = `${pseudonymousId}:${effectiveScore}:${attendanceRate}:${verifiedAt}`;
    const salt = process.env.BADGE_SALT || process.env.JWT_SECRET || 'pabandi_badge_salt_v1';
    const signedHash = 'sha256:' + crypto.createHmac('sha256', salt).update(payloadStr).digest('hex');

    // --- Autonomous Blockchain Sync ---
    prisma.wallet.findUnique({ where: { userId } }).then(async wallet => {
      if (wallet?.address) {
        const aiTrustProfile = await dashscopeService.generateTrustProfile(userId);
        blockchainService.checkAndMintEligibleBadge(
          wallet.address,
          pseudonymousId,
          effectiveScore,
          totalBookings,
          attendanceRate,
          aiTrustProfile
        ).catch(err => logger.error('[AutonomousSync] Error syncing badge:', err.message));
      }
    }).catch(err => logger.error('[AutonomousSync] Error fetching wallet:', err.message));

    return {
      pseudonymousId,
      tier,
      reliabilityScore: effectiveScore,
      baseReliabilityScore: normalizeReliabilityScore(baseScore),
      commerceScore: user.commerceScore,
      hospitalityScore: user.hospitalityScore,
      appointmentScore: user.appointmentScore,
      freelanceScore: user.freelanceScore,
      attendanceRate,
      totalBookings,
      completedBookings: completed,
      socialSignals: identities.map(i => i.platform),
      badges,
      socialTrustBoost: totalBoost,
      graphTrustBoost,
      verifiedAt: new Date().toISOString(),
      signedHash,
    };
  }

  /**
   * Generate the share card payload for a user's social post.
   *
   * ─── WHY THE COPY IS CONDITIONAL ───────────────────────────────────────────
   *
   * Two separate lies used to live in these strings.
   *
   * The number: `${badge.reliabilityScore}/100` was correct arithmetic against
   * the wrong value. The score came from a column defaulting to 750, so every
   * card published a score that had no relationship to the user's behaviour. It
   * is now clamped and sourced from the canonical writer, and "N/100" means N
   * out of 100 — checkable against `/api/v1/reliability/:userId`.
   *
   * The claim: "Another on-time arrival" and "You actually show up" assert a
   * booking history. A user with zero bookings — the default case for anyone who
   * just signed up and clicked "share" — got told they had arrived on time. The
   * copy now branches on whether there is anything behind the number, because a
   * share card that overstates the evidence is worse than one that understates
   * it: the first is the platform making a claim on the user's behalf that the
   * platform cannot support.
   */
  async getShareCard(userId: string, platform: string): Promise<Record<string, string>> {
    const badge = await this.computeBadgeStatus(userId);
    const hasHistory = badge.completedBookings > 0;
    const scoreText = `${badge.reliabilityScore}/100`;

    const streakText = hasHistory
      ? `${badge.completedBookings} of ${badge.totalBookings} appointments kept`
      : 'New on Pabandi — no bookings yet, so this is my starting score';

    const cards: Record<string, string> = {
      X_TWITTER: hasHistory
        ? `Another on-time arrival. Reliability score: ${scoreText}. ${streakText}. #PabandiReliable #BookingTrust`
        : `Just joined Pabandi. Starting reliability score: ${scoreText}. ${streakText}. #PabandiReliable`,
      LINKEDIN: `Pabandi Reliability Score: ${scoreText} (${badge.tier}). ${streakText}. Verified by Pabandi.\n\n#Reliability #ProfessionalDevelopment #Pabandi`,
      INSTAGRAM: `✨ Reliability score: ${scoreText}. ${streakText}. Verified by @pabandiglobal 🏆 #PabandiReliable`,
      FACEBOOK: `Proud to share my Pabandi Reliability Score: ${scoreText}. ${streakText}. Building trust one booking at a time!`,
      TIKTOK: `POV: ${hasHistory ? 'you actually show up 💯' : 'you start honest 💯'} Reliability score: ${scoreText}. ${streakText}. #PabandiReliable #BookingTrust #ShowUp`,
      WHATSAPP: `Hey! My Pabandi Reliability Score: ${scoreText} — ${streakText}. ✅`,
    };

    return {
      platform,
      text: cards[platform] ?? cards['X_TWITTER'],
      badgeUrl: `https://pabandi.com/verify/${badge.pseudonymousId}`,
      // Bare number, no denominator. The `/100` lives in the copy above, where a
      // reader can see it; returning `"75/100"` from a field named `score`
      // would parse as 7500 in anything that expects a number.
      score: String(badge.reliabilityScore),
      scale: '0-100',
      tier: badge.tier,
    };
  }
}

export const badgeService = new BadgeService();
