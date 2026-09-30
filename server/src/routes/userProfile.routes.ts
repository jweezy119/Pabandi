import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

const USERNAME_REGEX = /^[a-z0-9-]{3,20}$/;

const PLATFORM_DOMAINS: Record<string, string[]> = {
  linkedin: ['linkedin.com'],
  x: ['x.com', 'twitter.com'],
  github: ['github.com'],
  instagram: ['instagram.com'],
  youtube: ['youtube.com', 'youtu.be'],
  tiktok: ['tiktok.com'],
  website: [],
  custom: [],
};

function verifyPlatformUrl(platform: string, url: string): boolean {
  const domains = PLATFORM_DOMAINS[platform];
  if (!domains || domains.length === 0) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

async function checkUrlResolves(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, { timeout: 5000, maxRedirects: 3 });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function verifySocialLink(platform: string, url: string): Promise<boolean> {
  if (!verifyPlatformUrl(platform, url)) return false;
  return checkUrlResolves(url);
}

// GET /api/v1/user/profile — get own full profile
router.get('/profile', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        socialLinks: { orderBy: { position: 'asc' } },
        portfolioItems: { orderBy: { position: 'asc' } },
      },
    });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { passwordHash, ...safeUser } = user;
    return res.json({ success: true, data: safeUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] get error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// PATCH /api/v1/user/profile — update profile
router.patch('/profile', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      username, bio, tagline, location, websiteUrl, avatarUrl, bannerUrl,
      bannerColor, accentColor, isPublic, showScores, showSocialLinks,
      showPortfolio, layoutStyle,
    } = req.body;

    if (username !== undefined) {
      if (!USERNAME_REGEX.test(username)) {
        return res.status(400).json({ success: false, error: 'Username must be 3-20 chars, lowercase alphanumeric + dash' });
      }
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ success: false, error: 'Username already taken' });
      }
    }

    if (layoutStyle !== undefined && !['classic', 'compact', 'showcase'].includes(layoutStyle)) {
      return res.status(400).json({ success: false, error: 'Invalid layout style' });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(username !== undefined && { username }),
        ...(bio !== undefined && { bio }),
        ...(tagline !== undefined && { tagline }),
        ...(location !== undefined && { location }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bannerUrl !== undefined && { bannerUrl }),
        ...(bannerColor !== undefined && { bannerColor }),
        ...(accentColor !== undefined && { accentColor }),
        ...(isPublic !== undefined && { isPublic }),
        ...(showScores !== undefined && { showScores }),
        ...(showSocialLinks !== undefined && { showSocialLinks }),
        ...(showPortfolio !== undefined && { showPortfolio }),
        ...(layoutStyle !== undefined && { layoutStyle }),
      },
      include: {
        socialLinks: { orderBy: { position: 'asc' } },
        portfolioItems: { orderBy: { position: 'asc' } },
      },
    });

    const { passwordHash, ...safeUser } = user;
    return res.json({ success: true, data: safeUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] update error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/user/profile/:username — public profile
router.get('/profile/:username', apiLimiter, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: {
        socialLinks: { orderBy: { position: 'asc' } },
        portfolioItems: { orderBy: { position: 'asc' } },
      },
    });

    if (!user || !user.isPublic) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    const { passwordHash, email, phone, nonce, ...publicUser } = user;

    const passport = await prisma.trustPassport.findFirst({ where: { userId: user.id } });
    const attestationCount = passport
      ? await prisma.onchainAttestation.count({ where: { passportId: passport.id } })
      : 0;

    return res.json({
      success: true,
      data: {
        ...publicUser,
        attestationCount,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] public error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/u/:username — public profile (no auth, no PII)
router.get('/u/:username', apiLimiter, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: {
        socialLinks: { orderBy: { position: 'asc' } },
        portfolioItems: { orderBy: { position: 'asc' } },
      },
    });

    if (!user || !user.isPublic) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    const { passwordHash, email, phone, nonce, walletAddress, stripeCustomerId, ...safeUser } = user;

    const passport = await prisma.trustPassport.findFirst({ where: { userId: user.id } });
    const attestationCount = passport
      ? await prisma.onchainAttestation.count({ where: { passportId: passport.id } })
      : 0;

    return res.json({
      success: true,
      data: {
        ...safeUser,
        attestationCount,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] public u error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/u/:username/attestations — paginated onchain attestations
router.get('/u/:username/attestations', apiLimiter, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user || !user.isPublic) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    const passport = await prisma.trustPassport.findFirst({ where: { userId: user.id } });
    if (!passport) return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0 } });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [attestations, total] = await Promise.all([
      prisma.onchainAttestation.findMany({
        where: { passportId: passport.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.onchainAttestation.count({ where: { passportId: passport.id } }),
    ]);

    return res.json({
      success: true,
      data: attestations,
      pagination: { page, limit, total },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] attestations error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/u/:username/activity — trust event timeline
router.get('/u/:username/activity', apiLimiter, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user || !user.isPublic) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [trustAudits, total] = await Promise.all([
      prisma.trustAuditTrail.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.trustAuditTrail.count({ where: { userId: user.id } }),
    ]);

    return res.json({
      success: true,
      data: trustAudits,
      pagination: { page, limit, total },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] activity error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── Social Links ──────────────────────────────────────────────────

router.post('/social-links', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, url, displayName } = req.body;
    if (!platform || !url) return res.status(400).json({ success: false, error: 'Platform and URL required' });

    const count = await prisma.socialLink.count({ where: { userId: req.user!.id } });
    if (count >= 10) return res.status(400).json({ success: false, error: 'Maximum 10 social links' });

    const verified = await verifySocialLink(platform, url);
    const link = await prisma.socialLink.create({
      data: { userId: req.user!.id, platform, url, displayName, verified, position: count },
    });
    return res.json({ success: true, data: link });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] create social link error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch('/social-links/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { platform, url, displayName } = req.body;
    const existing = await prisma.socialLink.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Link not found' });

    const finalPlatform = platform || existing.platform;
    const finalUrl = url || existing.url;
    const verified = url ? await verifySocialLink(finalPlatform, finalUrl) : existing.verified;

    const link = await prisma.socialLink.update({
      where: { id: req.params.id },
      data: {
        ...(platform && { platform }),
        ...(url && { url }),
        ...(displayName !== undefined && { displayName }),
        verified,
      },
    });
    return res.json({ success: true, data: link });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] update social link error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/social-links/:id/verify', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.socialLink.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Link not found' });

    const verified = await verifySocialLink(existing.platform, existing.url);
    const link = await prisma.socialLink.update({
      where: { id: req.params.id },
      data: { verified },
    });
    return res.json({ success: true, data: link });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] verify social link error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.delete('/social-links/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.socialLink.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Link not found' });

    await prisma.socialLink.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] delete social link error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch('/social-links/reorder', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids array required' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.socialLink.updateMany({ where: { id, userId: req.user!.id }, data: { position: index } })
      )
    );
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] reorder social links error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── Portfolio ─────────────────────────────────────────────────────

router.post('/portfolio', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, mediaUrl, linkUrl } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title required' });

    const count = await prisma.portfolioItem.count({ where: { userId: req.user!.id } });
    if (count >= 12) return res.status(400).json({ success: false, error: 'Maximum 12 portfolio items' });

    const item = await prisma.portfolioItem.create({
      data: { userId: req.user!.id, title, description, mediaUrl, linkUrl, position: count },
    });
    return res.json({ success: true, data: item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] create portfolio error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch('/portfolio/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, mediaUrl, linkUrl } = req.body;
    const existing = await prisma.portfolioItem.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Item not found' });

    const item = await prisma.portfolioItem.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(mediaUrl !== undefined && { mediaUrl }),
        ...(linkUrl !== undefined && { linkUrl }),
      },
    });
    return res.json({ success: true, data: item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] update portfolio error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.delete('/portfolio/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Item not found' });

    await prisma.portfolioItem.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] delete portfolio error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch('/portfolio/reorder', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ success: false, error: 'ids array required' });

    await prisma.$transaction(
      ids.map((id: string, index: number) =>
        prisma.portfolioItem.updateMany({ where: { id, userId: req.user!.id }, data: { position: index } })
      )
    );
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[UserProfile] reorder portfolio error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
