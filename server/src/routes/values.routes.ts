import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.get('/preferences', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { valuesPreferences: true },
    });
    return res.json({ success: true, data: user?.valuesPreferences || {} });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.put('/preferences', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { valuesPreferences: req.body.preferences || {} },
      select: { valuesPreferences: true },
    });
    return res.json({ success: true, data: user.valuesPreferences });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Values] update preferences error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/business/:businessId', apiLimiter, async (req, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params.businessId },
      select: { valuesPreferences: true, name: true },
    });
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    return res.json({ success: true, data: business.valuesPreferences || {} });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.put('/business/:businessId', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const business = await prisma.business.findFirst({
      where: { id: req.params.businessId, ownerId: req.user!.id },
    });
    if (!business) return res.status(403).json({ success: false, error: 'Not authorized' });

    const updated = await prisma.business.update({
      where: { id: req.params.businessId },
      data: { valuesPreferences: req.body.preferences || {} },
      select: { valuesPreferences: true },
    });
    return res.json({ success: true, data: updated.valuesPreferences });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Values] update business preferences error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
