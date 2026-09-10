import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { cryptoService } from '../services/cryptoService';
import { STAR_TIER_POINTS, STAR_TIER_ORDER, calculateStarTier } from '../controllers/pabandiReview.controller';

const router = Router();

/**
 * GET /api/v1/sitara/star-finder
 * Operator: Get top reviewers by star tier for their business
 * Query: ?businessId=xxx&minTier=tara&limit=50
 */
router.get('/star-finder', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId, minTier = 'tara', limit = '50' } = req.query;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
    });

    if (!business) {
      return res.status(403).json({ error: 'Not your business' });
    }

    // Aggregate per-customer from reviews at this business (StarPower has
    // no direct relation to reviews, so group the reviews in code).
    const reviews = await prisma.pabandiReview.findMany({
      where: { businessId: String(businessId) },
      select: {
        id: true,
        rating: true,
        starPoints: true,
        upvoteCount: true,
        createdAt: true,
        text: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePictureUrl: true,
            reliabilityScore: true,
            starPowerTier: true,
            starPowerPoints: true,
            starPower: { select: { totalPoints: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const minTierIndex = STAR_TIER_ORDER.indexOf(minTier as any);
    const byCustomer = new Map<string, { customer: any; totalPoints: number; reviews: any[] }>();
    for (const r of reviews) {
      const entry = byCustomer.get(r.customerId) ?? {
        customer: r.customer,
        totalPoints: r.customer.starPower?.totalPoints ?? r.customer.starPowerPoints ?? 0,
        reviews: [],
      };
      entry.reviews.push(r);
      byCustomer.set(r.customerId, entry);
    }

    const results = [...byCustomer.values()]
      .filter(entry => {
        const userTier = entry.customer.starPowerTier || 'tara';
        return STAR_TIER_ORDER.indexOf(userTier) >= minTierIndex;
      })
      .map(entry => {
        const tier = (entry.customer.starPowerTier || calculateStarTier(entry.totalPoints)) as keyof typeof STAR_TIER_POINTS;
        const tierInfo = STAR_TIER_POINTS[tier];
        const custReviews = entry.reviews;
        return {
          userId: entry.customer.id,
          name: `${entry.customer.firstName} ${entry.customer.lastName}`,
          avatar: entry.customer.profilePictureUrl,
          reliabilityScore: entry.customer.reliabilityScore,
          totalPoints: entry.totalPoints,
          tier,
          tierName: tierInfo?.name,
          tierNameUrdu: tierInfo?.nameUrdu,
          tierColor: tierInfo?.color,
          reviewCount: custReviews.length,
          avgRating: custReviews.length > 0
            ? custReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / custReviews.length
            : 0,
          totalUpvotes: custReviews.reduce((sum: number, r: any) => sum + (r.upvoteCount || 0), 0),
          lastReview: custReviews[0]?.createdAt,
          topReview: [...custReviews].sort((a: any, b: any) => (b.rating * 10 + b.upvoteCount) - (a.rating * 10 + a.upvoteCount))[0],
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, Number(limit));

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sitara/promos
 * Operator: Send a promo to a specific star tier
 */
router.post('/promos', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId, targetTier, title, description, value, promoType, expiresAt, maxRedemptions } = req.body;

    if (!businessId || !title || !description || value == null || !promoType || !expiresAt) {
      return res.status(400).json({ error: 'businessId, title, description, value, promoType, expiresAt required' });
    }

    // Verify user owns the business
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: req.user!.id },
    });

    if (!business) {
      return res.status(403).json({ error: 'Not your business' });
    }

    // Generate promo code
    const code = `SITARA_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const promo = await prisma.starPromo.create({
      data: {
        businessId: String(businessId),
        senderId: req.user!.id,
        targetTier: targetTier || null,
        title,
        description,
        value: Number(value),
        promoType,
        code,
        expiresAt: new Date(expiresAt),
        maxRedemptions: maxRedemptions || null,
      },
    });

    res.status(201).json({ success: true, data: promo });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/sitara/my-promos
 * Get promos sent to the current user based on their star tier
 */
router.get('/my-promos', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { starPowerTier: true } });
    const userTier = dbUser?.starPowerTier || 'tara';

    const now = new Date();

    // Get active promos that match the user's tier (or are for all tiers)
    const promos = await prisma.starPromo.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now },
        OR: [
          { targetTier: null }, // All tiers
          { targetTier: userTier }, // Specific tier match
        ],
      },
      include: {
        business: { select: { name: true, logoUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check which ones the user has already redeemed
    const userRedemptions = await prisma.starPromoRedemption.findMany({
      where: { userId, promo: { id: { in: promos.map(p => p.id) } } },
      select: { promoId: true },
    });

    const redeemedIds = new Set(userRedemptions.map(r => r.promoId));

    const result = promos.map(p => ({
      ...p,
      alreadyRedeemed: redeemedIds.has(p.id),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sitara/redeem/:code
 * Redeem a star promo code
 */
router.post('/redeem/:code', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const userId = req.user!.id;

    const now = new Date();
    const promo = await prisma.starPromo.findUnique({
      where: { code: String(code) },
    });

    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: 'Promo not found or expired' });
    }

    if (promo.expiresAt < now) {
      return res.status(400).json({ error: 'Promo expired' });
    }

    if (promo.maxRedemptions && promo.redeemedCount >= promo.maxRedemptions) {
      return res.status(400).json({ error: 'Promo fully redeemed' });
    }

    // Check tier eligibility (fresh from DB — JWT may be stale)
    const dbRedeemer = await prisma.user.findUnique({ where: { id: userId }, select: { starPowerTier: true } });
    const userTier = dbRedeemer?.starPowerTier || 'tara';
    if (promo.targetTier && promo.targetTier !== userTier) {
      return res.status(403).json({ error: 'Not eligible for this promo' });
    }

    // Create redemption
    const redemption = await prisma.starPromoRedemption.create({
      data: {
        promoId: promo.id,
        userId,
      },
    });

    // Increment redemption count
    await prisma.starPromo.update({
      where: { id: promo.id },
      data: { redeemedCount: { increment: 1 } },
    });

    res.status(201).json({
      success: true,
      message: `Promo ${code} redeemed!`,
      data: { promo, redemption },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already redeemed this promo' });
    }
    next(error);
  }
});

/**
 * GET /api/v1/sitara/promos?businessId=xxx
 * Operator: list promos for own business with redemption counts.
 */
router.get('/promos', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    const business = await prisma.business.findFirst({
      where: { id: String(businessId), ownerId: req.user!.id },
    });
    if (!business) {
      return res.status(403).json({ error: 'Not your business' });
    }
    const promos = await prisma.starPromo.findMany({
      where: { businessId: String(businessId) },
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: promos });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sitara/redemptions/:id/use
 * Operator POS seam: mark a customer's promo redemption as consumed at the
 * venue (scan code → verify → mark used). Future POS takes over this call.
 */
router.post('/redemptions/:id/use', authenticate, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const redemption = await prisma.starPromoRedemption.findUnique({
      where: { id: String(id) },
      include: {
        promo: { include: { business: { select: { ownerId: true, name: true } } } },
      },
    });
    if (!redemption) {
      return res.status(404).json({ error: 'Redemption not found' });
    }
    if (redemption.promo.business.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Not your business' });
    }
    if (redemption.usedAt) {
      return res.status(409).json({ error: 'Already used' });
    }
    const updated = await prisma.starPromoRedemption.update({
      where: { id: redemption.id },
      data: { usedAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
