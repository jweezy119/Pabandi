import { Router, Request, Response } from 'express';
import { promotionsService } from '../services/promotions.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Public: List promotions ───────────────────────────────────────────────
router.get('/promotions', async (req: Request, res: Response) => {
  try {
    const { businessId, active, segment } = req.query;
    const promotions = await promotionsService.listPromotions({
      businessId: businessId as string,
      active: active === 'true',
      segment: segment as string,
    });
    res.json({ success: true, data: promotions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

// ── Public: Get available promotions for user ─────────────────────────────
router.get('/promotions/available', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const promotions = await promotionsService.getAvailableForUser(userId);
    res.json({ success: true, data: promotions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load available promotions' });
  }
});

// ── Authenticated: Redeem promotion ───────────────────────────────────────
router.post('/promotions/:id/redeem', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const redemption = await promotionsService.redeemPromotion(userId, req.params.id);
    res.status(201).json({ success: true, data: redemption });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to redeem' });
  }
});

// ── Authenticated: Use promotion ──────────────────────────────────────────
router.post('/promotions/use/:code', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { purchaseAmount } = req.body;
    const result = await promotionsService.usePromotion(userId, req.params.code, purchaseAmount);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to use promotion' });
  }
});

// ── Authenticated: Get my redemptions ─────────────────────────────────────
router.get('/promotions/my', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const redemptions = await promotionsService.getUserRedemptions(userId);
    res.json({ success: true, data: redemptions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load redemptions' });
  }
});

// ── Vendor: Create promotion ──────────────────────────────────────────────
router.post('/vendor/promotions', authenticate, async (req: any, res: Response) => {
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
    
    const promotion = await promotionsService.createPromotion({
      businessId,
      ...req.body,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
    });
    res.status(201).json({ success: true, data: promotion });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create promotion' });
  }
});

// ── Vendor: Get my promotions ─────────────────────────────────────────────
router.get('/vendor/promotions', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const businesses = await prisma.business.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });
    const businessIds = businesses.map(b => b.id);
    
    const promotions = await prisma.vendorPromotion.findMany({
      where: { businessId: { in: businessIds } },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: promotions });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load promotions' });
  }
});

// ── Vendor: Get analytics ─────────────────────────────────────────────────
router.get('/vendor/analytics', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { businessId } = req.query;
    
    // Verify ownership
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const business = await prisma.business.findFirst({
      where: { id: businessId as string, ownerId: userId },
    });
    if (!business) return res.status(403).json({ error: 'Not your business' });
    
    const analytics = await promotionsService.getVendorAnalytics(businessId as string);
    res.json({ success: true, data: analytics });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ── Public: Get loyalty membership ────────────────────────────────────────
router.get('/loyalty/:businessId', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const membership = await promotionsService.getMembership(userId, req.params.businessId);
    res.json({ success: true, data: membership });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load membership' });
  }
});

// ── Authenticated: Redeem loyalty points ──────────────────────────────────
router.post('/loyalty/:businessId/redeem', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { points } = req.body;
    const result = await promotionsService.redeemPoints(userId, req.params.businessId, points);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to redeem points' });
  }
});

export default router;
