import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Escrow state machine: PENDING → FUNDED → COMPLETED | DISPUTED | CANCELLED
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['FUNDED', 'CANCELLED'],
  FUNDED: ['COMPLETED', 'DISPUTED', 'CANCELLED'],
  DISPUTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

// ── POST /api/v1/escrow ─────────────────────────────────────────────────────
// Open a secured sale (buyer + seller + item + amount).
router.post('/', async (req: Request, res: Response) => {
  try {
    const { itemTitle, amount, currency = 'USD', sellerEmail, buyerEmail, listingUrl, referralCode, meetupLocation, meetupLat, meetupLng, meetupAt } = req.body;

    if (!itemTitle || !amount || !sellerEmail) {
      return res.status(400).json({ success: false, error: 'itemTitle, amount, and sellerEmail are required' });
    }

    const escrow = await prisma.localSaleEscrow.create({
      data: {
        itemTitle, amount: parseFloat(amount), currency, sellerEmail, buyerEmail,
        listingUrl, referralCode, meetupLocation, meetupLat, meetupLng,
        meetupAt: meetupAt ? new Date(meetupAt) : undefined,
        status: 'PENDING', simulated: true,
      },
    });

    res.status(201).json({ success: true, data: escrow });
  } catch (e: any) {
    logger.error('Escrow create failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/escrow/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) return res.status(404).json({ success: false, error: 'Escrow not found' });
    res.json({ success: true, data: escrow });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/escrow/:id/fund ────────────────────────────────────────────
// Buyer funds the escrow.
router.post('/:id/fund', async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) return res.status(404).json({ success: false, error: 'Escrow not found' });
    if (!VALID_TRANSITIONS[escrow.status]?.includes('FUNDED')) {
      return res.status(400).json({ success: false, error: `Cannot fund from status ${escrow.status}` });
    }

    const updated = await prisma.localSaleEscrow.update({
      where: { id: escrow.id },
      data: { status: 'FUNDED' },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/escrow/:id/release ─────────────────────────────────────────
// Buyer confirms receipt — funds release to seller.
router.post('/:id/release', async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) return res.status(404).json({ success: false, error: 'Escrow not found' });
    if (!VALID_TRANSITIONS[escrow.status]?.includes('COMPLETED')) {
      return res.status(400).json({ success: false, error: `Cannot release from status ${escrow.status}` });
    }

    const updated = await prisma.localSaleEscrow.update({
      where: { id: escrow.id },
      data: { status: 'COMPLETED' },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/escrow/:id/dispute ─────────────────────────────────────────
// Either party files a dispute.
router.post('/:id/dispute', async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) return res.status(404).json({ success: false, error: 'Escrow not found' });
    if (!VALID_TRANSITIONS[escrow.status]?.includes('DISPUTED')) {
      return res.status(400).json({ success: false, error: `Cannot dispute from status ${escrow.status}` });
    }

    const updated = await prisma.localSaleEscrow.update({
      where: { id: escrow.id },
      data: { status: 'DISPUTED' },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/escrow/:id/cancel ──────────────────────────────────────────
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.localSaleEscrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) return res.status(404).json({ success: false, error: 'Escrow not found' });
    if (!VALID_TRANSITIONS[escrow.status]?.includes('CANCELLED')) {
      return res.status(400).json({ success: false, error: `Cannot cancel from status ${escrow.status}` });
    }

    const updated = await prisma.localSaleEscrow.update({
      where: { id: escrow.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/escrow ─────────────────────────────────────────────────────
// List escrows by email (buyer or seller).
router.get('/', async (req: Request, res: Response) => {
  try {
    const { email, status } = req.query as Record<string, string>;
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });

    const where: any = { OR: [{ sellerEmail: email }, { buyerEmail: email }] };
    if (status) where.status = status;

    const escrows = await prisma.localSaleEscrow.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 50,
    });

    res.json({ success: true, data: escrows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
