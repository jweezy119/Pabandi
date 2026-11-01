import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/booking/businesses - List businesses for BookingOS Discovery
router.get('/businesses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category } = req.query;

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const businesses = await prisma.business.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { rating: 'desc' },
    });

    return res.json({
      success: true,
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category as string,
        rating: b.rating ?? 0,
        address: b.address,
        city: b.city,
        email: b.email,
        website: b.website,
        ownerName: b.user ? `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim() : undefined,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Booking] businesses error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
