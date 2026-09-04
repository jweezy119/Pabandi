import { Router, Request, Response } from 'express';
import { partnerRewardsService } from '../services/partnerRewards.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Public: List active offers ────────────────────────────────────────────
router.get('/offers', async (req: Request, res: Response) => {
  try {
    const { category, businessId } = req.query;
    const offers = await partnerRewardsService.listOffers({
      category: category as string,
      businessId: businessId as string,
      active: true,
    });
    res.json({ success: true, data: offers });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load offers' });
  }
});

// ── Public: Get offer details ─────────────────────────────────────────────
router.get('/offers/:id', async (req: Request, res: Response) => {
  try {
    const offer = await partnerRewardsService.getOffer(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    res.json({ success: true, data: offer });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load offer' });
  }
});

// ── Authenticated: Redeem offer ───────────────────────────────────────────
router.post('/offers/:id/redeem', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const reward = await partnerRewardsService.redeemOffer(userId, req.params.id);
    res.status(201).json({ success: true, data: reward });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to redeem' });
  }
});

// ── Authenticated: Confirm redemption (after purchase) ────────────────────
router.post('/rewards/:code/confirm', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { purchaseAmount } = req.body;
    const reward = await partnerRewardsService.confirmRedemption(userId, req.params.code, purchaseAmount);
    res.json({ success: true, data: reward });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to confirm' });
  }
});

// ── Authenticated: Get my rewards ─────────────────────────────────────────
router.get('/rewards', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const rewards = await partnerRewardsService.getUserRewards(userId);
    res.json({ success: true, data: rewards });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load rewards' });
  }
});

// ── Public: Verify redemption code ────────────────────────────────────────
router.get('/rewards/verify/:code', async (req: Request, res: Response) => {
  try {
    const reward = await partnerRewardsService.getRewardByCode(req.params.code);
    if (!reward) return res.status(404).json({ error: 'Code not found' });
    res.json({ success: true, data: reward });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to verify' });
  }
});

// ── Partner: Create offer ─────────────────────────────────────────────────
router.post('/partner/offers', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { businessId, title, description, category, rewardType, rewardValue, maxRewardAmount, minPurchase, maxRedemptions, perUserLimit, startsAt, endsAt } = req.body;
    
    // Verify user owns this business
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) return res.status(403).json({ error: 'Not your business' });
    
    const offer = await partnerRewardsService.createOffer({
      businessId,
      title,
      description,
      category,
      rewardType,
      rewardValue,
      maxRewardAmount,
      minPurchase,
      maxRedemptions,
      perUserLimit,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    });
    res.status(201).json({ success: true, data: offer });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create offer' });
  }
});

// ── Partner: List my offers ───────────────────────────────────────────────
router.get('/partner/offers', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const businesses = await prisma.business.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const businessIds = businesses.map(b => b.id);
    
    const offers = await prisma.partnerOffer.findMany({
      where: { businessId: { in: businessIds } },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: offers });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load offers' });
  }
});

// ── Partner: Get analytics ────────────────────────────────────────────────
router.get('/partner/analytics', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { businessId } = req.body;
    
    // Verify ownership
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) return res.status(403).json({ error: 'Not your business' });
    
    const analytics = await partnerRewardsService.getPartnerAnalytics(businessId);
    res.json({ success: true, data: analytics });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ── Public: Get stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await partnerRewardsService.getStats();
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
