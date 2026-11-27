import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { autoRepairService } from '../services/autoRepair.service';
import { prisma } from '../utils/database';

const router = Router();

/**
 * GET /api/v1/auto-repair/shops
 * Search auto repair shops with Trust Scores & next available bay.
 */
router.get('/shops', async (req: Request, res: Response) => {
  try {
    const data = await autoRepairService.searchAutoRepair({
      location: req.query.location ? String(req.query.location) : undefined,
      serviceType: req.query.serviceType ? String(req.query.serviceType) : undefined,
    });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Search failed' });
  }
});

/**
 * GET /api/v1/auto-repair/shops/:shopId/trust
 * Public shop ML Trust Score breakdown (Fair Price + Communication).
 */
router.get('/shops/:shopId/trust', async (req: Request, res: Response) => {
  try {
    const data = await autoRepairService.checkShopTrust({ shopId: req.params.shopId });
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: err?.message || 'Shop not found' });
  }
});

/**
 * GET /api/v1/auto-repair/orders
 * List repair orders for the authenticated shop.
 */
router.get('/orders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(400).json({ success: false, error: 'Business context required' });
    const orders = await prisma.repairOrder.findMany({
      where: { businessId },
      include: { vehicle: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: orders });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch orders' });
  }
});

/**
 * POST /api/v1/auto-repair/orders/:id/estimate
 * Submit an itemized estimate through the AI Fair-Price Guardrail.
 */
router.post('/orders/:id/estimate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items, depositPercent } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }
    const result = await autoRepairService.submitEstimate(req.params.id, { items, depositPercent });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Estimate submission failed' });
  }
});

/**
 * POST /api/v1/auto-repair/orders/:id/photos
 * Upload Before / After / Inspection DVI photos and run AI Vision Proof-of-Work.
 */
router.post('/orders/:id/photos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { photos } = req.body ?? {};
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ success: false, error: 'photos array is required' });
    }
    const result = await autoRepairService.uploadDviPhotos(req.params.id, photos);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Photo upload failed' });
  }
});

export default router;
