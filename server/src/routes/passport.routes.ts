import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/passport/ensure — creates TrustPassport if none exists for this user
router.post('/ensure', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const existing = await prisma.trustPassport.findFirst({ where: { userId } });
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const handle = `user-${userId.slice(0, 8)}`;
    const passport = await prisma.trustPassport.create({
      data: {
        userId,
        handle,
        displayName: req.user?.firstName || 'User',
        visibility: 'PRIVATE',
      },
    });

    res.json({ success: true, data: passport });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
