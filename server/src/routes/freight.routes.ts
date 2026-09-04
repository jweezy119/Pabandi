import { Router, Request, Response } from 'express';
import { freightService } from '../services/freight.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── Loads ─────────────────────────────────────────────────────────────────
router.get('/loads', async (req: Request, res: Response) => {
  try {
    const { status, shipperId, originCity, destCity, cargoType, minWeight, maxWeight, pickupDate } = req.query;
    const loads = await freightService.listLoads({
      status: status as string,
      shipperId: shipperId as string,
      originCity: originCity as string,
      destCity: destCity as string,
      cargoType: cargoType as string,
      minWeight: minWeight ? Number(minWeight) : undefined,
      maxWeight: maxWeight ? Number(maxWeight) : undefined,
      pickupDate: pickupDate as string,
    });
    res.json({ success: true, data: loads });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load freight' });
  }
});

router.get('/loads/:id', async (req: Request, res: Response) => {
  try {
    const load = await freightService.getLoad(req.params.id);
    if (!load) return res.status(404).json({ error: 'Load not found' });
    res.json({ success: true, data: load });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load details' });
  }
});

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

router.patch('/loads/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status, location } = req.body;
    const load = await freightService.updateLoadStatus(req.params.id, status, location);
    res.json({ success: true, data: load });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update status' });
  }
});

// ── Bids ──────────────────────────────────────────────────────────────────
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

router.post('/bids/:id/accept', authenticate, async (req: any, res: Response) => {
  try {
    const bid = await freightService.acceptBid(req.params.id);
    res.json({ success: true, data: bid });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to accept bid' });
  }
});

router.post('/bids/:id/reject', authenticate, async (req: any, res: Response) => {
  try {
    const bid = await freightService.rejectBid(req.params.id);
    res.json({ success: true, data: bid });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to reject bid' });
  }
});

// ── Tracking ───────────────────────────────────────────────────────────────
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

router.get('/loads/:id/tracking', async (req: Request, res: Response) => {
  try {
    const tracking = await freightService.getTracking(req.params.id);
    res.json({ success: true, data: tracking });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load tracking' });
  }
});

// ── Documents ──────────────────────────────────────────────────────────────
router.post('/documents', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const doc = await freightService.uploadDocument({
      uploadedById: userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to upload document' });
  }
});

router.get('/documents', async (req: Request, res: Response) => {
  try {
    const { loadId, carrierId } = req.query;
    const docs = await freightService.getDocuments(loadId as string, carrierId as string);
    res.json({ success: true, data: docs });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// ── Messages ───────────────────────────────────────────────────────────────
router.post('/messages', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const message = await freightService.sendMessage({
      senderId: userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: message });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to send message' });
  }
});

router.get('/messages/:loadId', async (req: Request, res: Response) => {
  try {
    const messages = await freightService.getMessages(req.params.loadId);
    res.json({ success: true, data: messages });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ── Escrow ────────────────────────────────────────────────────────────────
router.post('/escrow', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await freightService.createEscrow(req.body);
    res.status(201).json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create escrow' });
  }
});

router.post('/escrow/:loadId/fund', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await freightService.fundEscrow(req.params.loadId);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fund escrow' });
  }
});

router.post('/escrow/:loadId/release', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await freightService.releaseEscrow(req.params.loadId);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to release escrow' });
  }
});

router.post('/escrow/:loadId/dispute', authenticate, async (req: any, res: Response) => {
  try {
    const { reason } = req.body;
    const escrow = await freightService.disputeEscrow(req.params.loadId, reason);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to dispute escrow' });
  }
});

// ── Insurance ──────────────────────────────────────────────────────────────
router.post('/insurance', authenticate, async (req: any, res: Response) => {
  try {
    const insurance = await freightService.purchaseInsurance(req.body);
    res.status(201).json({ success: true, data: insurance });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to purchase insurance' });
  }
});

router.get('/insurance/:loadId', async (req: Request, res: Response) => {
  try {
    const insurance = await freightService.getInsurance(req.params.loadId);
    res.json({ success: true, data: insurance });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load insurance' });
  }
});

// ── Scorecards ─────────────────────────────────────────────────────────────
router.post('/scorecards', authenticate, async (req: any, res: Response) => {
  try {
    const scorecard = await freightService.createScorecard(req.body);
    res.status(201).json({ success: true, data: scorecard });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create scorecard' });
  }
});

// ── Carriers ───────────────────────────────────────────────────────────────
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

router.get('/carriers', async (req: Request, res: Response) => {
  try {
    const { verified, state, equipmentType } = req.query;
    const carriers = await freightService.listCarriers({
      verified: verified === 'true',
      state: state as string,
      equipmentType: equipmentType as string,
    });
    res.json({ success: true, data: carriers });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load carriers' });
  }
});

router.get('/carriers/:id', async (req: Request, res: Response) => {
  try {
    const profile = await freightService.getCarrierProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Carrier not found' });
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load carrier' });
  }
});

router.patch('/carriers/:id/verify', authenticate, async (req: any, res: Response) => {
  try {
    const profile = await freightService.verifyCarrier(req.params.id);
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to verify carrier' });
  }
});

router.patch('/carriers/:id/availability', authenticate, async (req: any, res: Response) => {
  try {
    const profile = await freightService.updateCarrierAvailability(req.params.id, req.body);
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update availability' });
  }
});

// ── Rate Cards ─────────────────────────────────────────────────────────────
router.post('/rate-cards', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const rateCard = await freightService.createRateCard({
      carrierId: userId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: rateCard });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create rate card' });
  }
});

router.get('/rate-cards/:carrierId', async (req: Request, res: Response) => {
  try {
    const rateCards = await freightService.getRateCards(req.params.carrierId);
    res.json({ success: true, data: rateCards });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load rate cards' });
  }
});

// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await freightService.getStats();
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.get('/stats/:carrierId', async (req: Request, res: Response) => {
  try {
    const stats = await freightService.getCarrierStats(req.params.carrierId);
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load carrier stats' });
  }
});

export default router;
