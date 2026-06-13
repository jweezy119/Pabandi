import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { badgeService } from '../services/badge.service';

const router = Router();
router.use(authenticate);

// ─── Simulated OAuth metadata by platform ─────────────────────────────────────
// In production each platform gets its own OAuth flow. These are realistic
// stub profiles that simulate what the OAuth callback would return.
const STUB_PROFILES: Record<string, Partial<any>> = {
  LINKEDIN: {
    isVerified: true,
    completeness: 0.92,
    accountAgeDays: 365 * 6,
    platformHandle: 'linkedin-professional',
    trustBoost: 0,
  },
  FIVERR: {
    isVerified: false,
    rating: 4.9,
    completionRate: 0.98,
    accountLevel: 'Top Rated',
    accountAgeDays: 365 * 3,
    platformHandle: 'fiverr-creator',
    trustBoost: 0,
  },
  UPWORK: {
    isVerified: false,
    rating: 4.8,
    completionRate: 0.97,
    accountLevel: 'Top Rated Plus',
    accountAgeDays: 365 * 4,
    platformHandle: 'upwork-pro',
    trustBoost: 0,
  },
  X_TWITTER: {
    isVerified: true,
    accountAgeDays: 365 * 5,
    platformHandle: '@user_handle',
    trustBoost: 0,
  },
  TRUTH_SOCIAL: {
    isVerified: false,
    accountAgeDays: 365 * 2,
    platformHandle: '@user_handle',
    trustBoost: 0,
  },
};

const VALID_PLATFORMS = ['LINKEDIN', 'FIVERR', 'UPWORK', 'X_TWITTER', 'TRUTH_SOCIAL'];

/**
 * GET /api/v1/social/identities
 * Returns the authenticated user's connected social accounts.
 */
router.get('/identities', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const identities = await prisma.socialIdentity.findMany({ where: { userId } });

    const { totalBoost, breakdown } = badgeService.computeSocialTrustBoost(identities);

    return res.json({
      success: true,
      data: {
        identities,
        socialTrustBoost: totalBoost,
        breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/social/connect/:platform
 * Stub OAuth connect — saves a simulated SocialIdentity.
 * In production: redirect to OAuth provider → callback saves real data.
 */
router.post('/connect/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platform = req.params.platform.toUpperCase();
    const userId = req.user!.id;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }

    const stub = STUB_PROFILES[platform];

    // Compute trust boost for this single identity
    const { totalBoost } = badgeService.computeSocialTrustBoost([{ platform, ...stub }]);

    const identity = await prisma.socialIdentity.upsert({
      where: { userId_platform: { userId, platform: platform as any } },
      update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
      create: { userId, platform: platform as any, ...stub, trustBoost: totalBoost },
    });

    logger.info(`[Social] User ${userId} connected ${platform} (boost +${totalBoost})`);

    return res.status(201).json({
      success: true,
      data: { identity, trustBoost: totalBoost },
      message: `${platform} connected successfully. Your trust score received a +${totalBoost} boost.`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/social/disconnect/:platform
 * Removes a social identity. Score recalculates on next fetch.
 */
router.delete('/disconnect/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platform = req.params.platform.toUpperCase();
    const userId = req.user!.id;

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
    }

    await prisma.socialIdentity.deleteMany({
      where: { userId, platform: platform as any },
    });

    logger.info(`[Social] User ${userId} disconnected ${platform}`);

    return res.json({
      success: true,
      message: `${platform} disconnected. Your score will recalculate based on remaining signals.`,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Account not connected' });
    }
    next(error);
  }
});

/**
 * GET /api/v1/social/share-card?platform=LINKEDIN
 * Returns pre-written share text and badge URL for a given platform.
 */
router.get('/share-card', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const platform = (req.query.platform as string || 'X_TWITTER').toUpperCase();

    const card = await badgeService.getShareCard(userId, platform);

    return res.json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/social/my-badge
 * Returns the authenticated user's full badge payload including their pseudonymous ID.
 */
router.get('/my-badge', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const badge = await badgeService.computeBadgeStatus(userId);
    return res.json({ success: true, data: badge });
  } catch (error) {
    next(error);
  }
});

export default router;
