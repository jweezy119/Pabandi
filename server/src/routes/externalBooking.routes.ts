import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.post('/business/external-booking', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { externalBookingUrl, externalBookingPlatform } = req.body;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    // Validate URL
    try {
      new URL(externalBookingUrl);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        externalBookingUrl,
        externalBookingPlatform: externalBookingPlatform || 'other',
      },
    });

    return res.json({
      success: true,
      message: 'External booking link saved',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[ExternalBooking] error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
