import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

function getUserId(req: AuthRequest): string {
  return req.user!.id;
}

// ── GET /api/v1/notifications ───────────────────────────────────────────────
// Get notifications for the authenticated user (paginated)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { page = '1', limit = '20', filter = 'all' } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId };
    if (filter === 'unread') where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
      unreadCount,
    });
  } catch (e: any) {
    logger.error('Notifications fetch failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/notifications/unread-count ──────────────────────────────────
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const count = await prisma.notification.count({ where: { userId, read: false } });
    res.json({ success: true, count });
  } catch (e: any) {
    logger.error('Unread count fetch failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PATCH /api/v1/notifications/:id/read ────────────────────────────────────
// Mark a single notification as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json({ success: true, data: updated });
  } catch (e: any) {
    logger.error('Mark read failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/notifications/read-all ─────────────────────────────────────
// Mark all notifications as read
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    const userId = getUserId(req);

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (e: any) {
    logger.error('Mark all read failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/v1/notifications ──────────────────────────────────────────────
// Create a notification (internal use by services)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, type, title, body, actionUrl } = req.body;
    if (!userId || !type || !title) {
      return res.status(400).json({ success: false, error: 'userId, type, and title are required' });
    }

    const notification = await prisma.notification.create({
      data: { userId, type, title, body, actionUrl },
    });

    res.json({ success: true, data: notification });
  } catch (e: any) {
    logger.error('Notification create failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;