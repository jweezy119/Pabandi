import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ── GET /api/v1/notifications ───────────────────────────────────────────────
// Get notifications for a user (by email).
router.get('/', async (req: Request, res: Response) => {
  try {
    const { email, limit = '20' } = req.query as Record<string, string>;
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });

    // Gather from multiple sources
    const [bookingNotifs, disputeNotifs, escrowNotifs, reviewNotifs] = await Promise.all([
      // Booking-related notifications
      prisma.notificationLog.findMany({
        where: { recipient: email },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Disputes filed or against this user
      prisma.dispute.findMany({
        where: { OR: [{ reportedById: email }, { userId: email }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { votes: true },
      }),
      // Escrow updates
      prisma.localSaleEscrow.findMany({
        where: { OR: [{ sellerEmail: email }, { buyerEmail: email }] },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      // Reviews
      prisma.pabandiReview.findMany({
        where: { customerId: email },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Merge into a unified feed
    const feed = [
      ...bookingNotifs.map((n) => ({
        id: n.id,
        type: 'booking',
        subject: n.subject,
        message: n.message,
        status: n.status,
        createdAt: n.createdAt,
      })),
      ...disputeNotifs.map((d) => ({
        id: d.id,
        type: 'dispute',
        subject: `Dispute ${d.outcome}`,
        message: d.description?.slice(0, 100) || 'A dispute was filed',
        status: d.outcome,
        createdAt: d.createdAt,
      })),
      ...escrowNotifs.map((e) => ({
        id: e.id,
        type: 'escrow',
        subject: `Escrow ${e.status}`,
        message: `${e.itemTitle} - $${e.amount}`,
        status: e.status,
        createdAt: e.updatedAt,
      })),
      ...reviewNotifs.map((r) => ({
        id: r.id,
        type: 'review',
        subject: `Review received`,
        message: `${r.rating}★ rating`,
        status: 'RECEIVED',
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, parseInt(limit));

    res.json({ success: true, data: feed });
  } catch (e: any) {
    logger.error('Notifications fetch failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/notifications/read ─────────────────────────────────────────
// Mark notifications as read (simplified — just acknowledges receipt).
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    // In production: update read status in DB
    res.json({ success: true, message: `${ids?.length || 0} notifications marked as read` });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
