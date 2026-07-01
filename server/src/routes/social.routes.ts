import { Router, Response, NextFunction, Request } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { badgeService } from '../services/badge.service';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Real OAuth 2.0 Connection Endpoints ─────────────────────────────────────
// These routes must be BEFORE `router.use(authenticate)` because the OAuth 
// callback from Facebook/LinkedIn will not have the JWT Bearer header.

// FACEBOOK CONNECT
router.get('/connect/oauth/facebook', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!process.env.FACEBOOK_APP_ID) {
    return res.redirect(`${FRONTEND_URL}/profile?error=facebook_not_configured`);
  }
  // Securely pass the user's internal ID via a signed token in the state parameter
  const stateToken = jwt.sign({ userId: req.user!.id }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  passport.authenticate('facebook-connect', { scope: ['email', 'public_profile'], state: stateToken })(req, res, next);
});

router.get('/connect/facebook/callback',
  passport.authenticate('facebook-connect', { session: false, failureRedirect: `${FRONTEND_URL}/profile?error=facebook_failed` }),
  async (req: Request, res: Response) => {
    try {
      const profile = req.user as any;
      const stateToken = req.query.state as string;
      const decoded = jwt.verify(stateToken, process.env.JWT_SECRET!) as { userId: string };
      const userId = decoded.userId;

      const stub = {
        isVerified: true,
        accountAgeDays: 365 * 3, // Real OAuth would pull this from graph API if available
        platformHandle: profile.emails?.[0]?.value || profile.id,
        trustBoost: 0,
      };

      const { totalBoost } = badgeService.computeSocialTrustBoost([{ platform: 'FACEBOOK', ...stub }]);
      await prisma.socialIdentity.upsert({
        where: { userId_platform: { userId, platform: 'FACEBOOK' } },
        update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
        create: { userId, platform: 'FACEBOOK', ...stub, trustBoost: totalBoost },
      });

      // Also simulate Meta integration by connecting Instagram and Whatsapp automatically
      for (const p of ['INSTAGRAM', 'WHATSAPP']) {
        const { totalBoost: pBoost } = badgeService.computeSocialTrustBoost([{ platform: p, ...stub }]);
        await prisma.socialIdentity.upsert({
          where: { userId_platform: { userId, platform: p as any } },
          update: { ...stub, trustBoost: pBoost, lastRefreshed: new Date() },
          create: { userId, platform: p as any, ...stub, trustBoost: pBoost },
        });
      }

      return res.redirect(`${FRONTEND_URL}/profile?social_success=META`);
    } catch (e) {
      logger.error('Facebook connect callback error', e);
      return res.redirect(`${FRONTEND_URL}/profile?error=facebook_failed`);
    }
  }
);

// LINKEDIN CONNECT
router.get('/connect/oauth/linkedin', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!process.env.LINKEDIN_CLIENT_ID) {
    return res.redirect(`${FRONTEND_URL}/profile?error=linkedin_not_configured`);
  }
  const stateToken = jwt.sign({ userId: req.user!.id }, process.env.JWT_SECRET!, { expiresIn: '10m' });
  passport.authenticate('linkedin-connect', { state: stateToken })(req, res, next);
});

router.get('/connect/linkedin/callback',
  passport.authenticate('linkedin-connect', { session: false, failureRedirect: `${FRONTEND_URL}/profile?error=linkedin_failed` }),
  async (req: Request, res: Response) => {
    try {
      const profile = req.user as any;
      const stateToken = req.query.state as string;
      const decoded = jwt.verify(stateToken, process.env.JWT_SECRET!) as { userId: string };
      const userId = decoded.userId;

      const stub = {
        isVerified: true,
        completeness: 1.0,
        accountAgeDays: 365 * 2,
        platformHandle: profile.emails?.[0]?.value || profile.id,
        trustBoost: 0,
      };

      const { totalBoost } = badgeService.computeSocialTrustBoost([{ platform: 'LINKEDIN', ...stub }]);
      await prisma.socialIdentity.upsert({
        where: { userId_platform: { userId, platform: 'LINKEDIN' } },
        update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
        create: { userId, platform: 'LINKEDIN', ...stub, trustBoost: totalBoost },
      });

      return res.redirect(`${FRONTEND_URL}/profile?social_success=LINKEDIN`);
    } catch (e) {
      logger.error('LinkedIn connect callback error', e);
      return res.redirect(`${FRONTEND_URL}/profile?error=linkedin_failed`);
    }
  }
);

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
  X_TWITTER: {
    isVerified: true,
    accountAgeDays: 365 * 5,
    platformHandle: '@user_handle',
    trustBoost: 0,
  },
  WHATSAPP: {
    isVerified: true,
    accountAgeDays: 365 * 4,
    platformHandle: '+1-xxx-xxx-xxxx',
    trustBoost: 0,
  },
  TIKTOK: {
    isVerified: false,
    accountAgeDays: 365 * 2,
    platformHandle: '@user_tiktok',
    trustBoost: 0,
  },
  INSTAGRAM: {
    isVerified: true,
    accountAgeDays: 365 * 5,
    platformHandle: '@user_insta',
    completeness: 0.85,
    trustBoost: 0,
  },
  FACEBOOK: {
    isVerified: true,
    accountAgeDays: 365 * 8,
    platformHandle: 'facebook-user',
    completeness: 0.90,
    trustBoost: 0,
  },
  FIVERR: {
    isVerified: true,
    accountAgeDays: 365 * 4,
    platformHandle: 'fiverr_pro',
    rating: 4.9,
    completionRate: 0.98,
    accountLevel: 'Top Rated Seller',
    trustBoost: 0,
  },
  UPWORK: {
    isVerified: true,
    accountAgeDays: 365 * 3,
    platformHandle: 'upwork_talent',
    rating: 5.0,
    completionRate: 1.0,
    accountLevel: 'Top Rated Plus',
    trustBoost: 0,
  },
};

const VALID_PLATFORMS = ['LINKEDIN', 'X_TWITTER', 'WHATSAPP', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'FIVERR', 'UPWORK'];

// The three Meta-owned platforms that connect together
const META_PLATFORMS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'];

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
 * POST /api/v1/social/connect/META
 * Deprecated for real OAuth via /connect/oauth/facebook
 */
router.post('/connect/META', async (req: AuthRequest, res: Response, next: NextFunction) => {
  return res.status(400).json({ success: false, error: 'Please use the real Meta OAuth flow.' });
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

    if (platform === 'LINKEDIN' || platform === 'FACEBOOK') {
      return res.status(400).json({ success: false, error: `Please use the real OAuth flow for ${platform}.` });
    }

    const stub = { ...STUB_PROFILES[platform] };

    if (req.body.platformHandle) {
      stub.platformHandle = req.body.platformHandle;
    }

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
 * DELETE /api/v1/social/disconnect/META
 * Disconnects all Meta platforms at once.
 */
router.delete('/disconnect/META', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    await prisma.socialIdentity.deleteMany({
      where: { userId, platform: { in: META_PLATFORMS as any } },
    });

    logger.info(`[Social] User ${userId} disconnected all META platforms`);

    return res.json({
      success: true,
      message: `Meta platforms disconnected. WhatsApp, Instagram, and Facebook removed. Your score will recalculate.`,
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
