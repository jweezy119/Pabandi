import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { codEscrowService } from '../services/codEscrow.service';

const router = Router();

// POST /api/v1/cod/create
router.post('/create', authenticate, async (req: any, res: Response) => {
  try {
    const sellerId = req.user?.id;
    const { buyerId, amount, description, shippingAddress } = req.body;
    if (!buyerId || !amount || !description) {
      return res.status(400).json({ error: 'buyerId, amount, description are required' });
    }
    const escrow = await codEscrowService.createEscrow(sellerId, buyerId, {
      amount: parseFloat(amount),
      description,
      shippingAddress,
    });
    res.status(201).json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/pay
router.post('/:id/pay', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await codEscrowService.payIntoEscrow(req.params.id);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/ship
router.post('/:id/ship', authenticate, async (req: any, res: Response) => {
  try {
    const { trackingNumber } = req.body;
    if (!trackingNumber) return res.status(400).json({ error: 'trackingNumber is required' });
    const escrow = await codEscrowService.confirmShipment(req.params.id, trackingNumber);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/deliver
router.post('/:id/deliver', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await codEscrowService.confirmDelivery(req.params.id);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/release
router.post('/:id/release', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await codEscrowService.releaseFunds(req.params.id);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/dispute
router.post('/:id/dispute', authenticate, async (req: any, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const escrow = await codEscrowService.raiseDispute(req.params.id, reason);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/cod/:id/resolve
router.post('/:id/resolve', authenticate, async (req: any, res: Response) => {
  try {
    const { resolution } = req.body;
    if (!resolution || !['REFUND', 'RELEASE'].includes(resolution)) {
      return res.status(400).json({ error: 'resolution must be REFUND or RELEASE' });
    }
    const escrow = await codEscrowService.resolveDispute(req.params.id, resolution);
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/cod/history
router.get('/history', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const history = await codEscrowService.getEscrowHistory(userId);
    res.json({ success: true, data: history });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/cod/:id
router.get('/:id', authenticate, async (req: any, res: Response) => {
  try {
    const escrow = await codEscrowService.getEscrowById(req.params.id);
    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
