import { Router, Request, Response } from 'express';
import { freightService } from '../services/freight.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Public: List loads ────────────────────────────────────────────────────
router.get('/loads', async (req: Request, res: Response) => {
  try {
    const { status, originCity, destCity } = req.query;
    const loads = await freightService.listLoads({
      status: status as string,
      originCity: originCity as string,
      destCity: destCity as string,
    });
    res.json({ success: true, data: loads });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load freight' });
  }
});

// ── Public: Get load details ──────────────────────────────────────────────
router.get('/loads/:id', async (req: Request, res: Response) => {
  try {
    const load = await freightService.getLoad(req.params.id);
    if (!load) return res.status(404).json({ error: 'Load not found' });
    res.json({ success: true, data: load });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load details' });
  }
});

// ── Authenticated: Create load ────────────────────────────────────────────
router.post('/loads', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const load = await freightService.createLoad({
      shipperId: userId,
      ...req.body,
      pickupDate: new Date(req.body.pickupDate),
      deliveryDate: new Date(req.body.deliveryDate),
    });
    res.status(201).json({ success: true, data: load });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create load' });
  }
});

// ── Authenticated: Place bid ──────────────────────────────────────────────
router.post('/bids', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const bid = await freightService.placeBid({
      carrierId: userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: bid });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to place bid' });
  }
});

// ── Authenticated: Accept bid ─────────────────────────────────────────────
router.post('/bids/:id/accept', authenticate, async (req: any, res: Response) => {
  try {
    const bid = await freightService.acceptBid(req.params.id);
    res.json({ success: true, data: bid });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to accept bid' });
  }
});

// ── Authenticated: Add tracking ───────────────────────────────────────────
router.post('/loads/:id/tracking', authenticate, async (req: any, res: Response) => {
  try {
    const tracking = await freightService.addTrackingUpdate({
      loadId: req.params.id,
      ...req.body,
    });
    res.status(201).json({ success: true, data: tracking });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to add tracking' });
  }
});

// ── Authenticated: Create carrier profile ─────────────────────────────────
router.post('/carriers', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await freightService.createCarrierProfile({
      userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create profile' });
  }
});

// ── Public: List carriers ─────────────────────────────────────────────────
router.get('/carriers', async (req: Request, res: Response) => {
  try {
    const { verified, state } = req.query;
    const carriers = await freightService.listCarriers({
      verified: verified === 'true',
      state: state as string,
    });
    res.json({ success: true, data: carriers });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load carriers' });
  }
});

// ── Public: Get stats ─────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await freightService.getStats();
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
