import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

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
  attendanceRate: number;
  totalBookings: number;
  completedBookings: number;
  socialSignals: string[];
  badges: string[];
  socialTrustBoost: number;
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
        select: { reliabilityScore: true },
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

    const { totalBoost, breakdown } = this.computeSocialTrustBoost(identities);

    // Effective reliability score with social boost (capped at 100)
    const effectiveScore = Math.min(100, Math.round(user.reliabilityScore + totalBoost));
    const tier: BadgePayload['tier'] =
      effectiveScore >= 80 ? 'EXCELLENT' : effectiveScore >= 50 ? 'AVERAGE' : 'RISKY';

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

    return {
      pseudonymousId,
      tier,
      reliabilityScore: effectiveScore,
      attendanceRate,
      totalBookings,
      completedBookings: completed,
      socialSignals: identities.map(i => i.platform),
      badges,
      socialTrustBoost: totalBoost,
      verifiedAt,
      signedHash,
    };
  }

  /**
   * Generate the share card payload for a user's social post.
   */
  async getShareCard(userId: string, platform: string): Promise<Record<string, string>> {
    const badge = await this.computeBadgeStatus(userId);
    const streakText = badge.completedBookings > 0
      ? `${badge.completedBookings} consecutive appointments kept`
      : 'Building my reliability streak';

    const cards: Record<string, string> = {
      X_TWITTER: `Another on-time arrival. Reliability score: ${badge.reliabilityScore}/100. ${streakText}. #PabandiReliable #BookingTrust`,
      LINKEDIN: `Maintaining professional punctuality — ${streakText}. My Pabandi Reliability Score: ${badge.reliabilityScore}/100 (${badge.tier}). Verified by Pabandi AI.\n\n#Reliability #ProfessionalDevelopment #Pabandi`,
      INSTAGRAM: `✨ Reliability score: ${badge.reliabilityScore}/100. ${streakText}. Verified by @Pabandi 🏆 #PabandiReliable`,
      FACEBOOK: `Proud to share my Pabandi Reliability Score: ${badge.reliabilityScore}/100. ${streakText}. Building trust one booking at a time!`,
      TIKTOK: `POV: You actually show up 💯 Reliability score: ${badge.reliabilityScore}/100. ${streakText}. #PabandiReliable #BookingTrust #ShowUp`,
      WHATSAPP: `Hey! Check my Pabandi Reliability Score: ${badge.reliabilityScore}/100 — ${streakText}. Verified Reliable ✅`,
    };

    return {
      platform,
      text: cards[platform] ?? cards['X_TWITTER'],
      badgeUrl: `https://pabandi.com/verify/${badge.pseudonymousId}`,
      score: String(badge.reliabilityScore),
      tier: badge.tier,
    };
  }
}

export const badgeService = new BadgeService();
