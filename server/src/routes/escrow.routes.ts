import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/escrow/checkout
 * Returns a payment/deposit link for a given property + time slot.
 */
router.post('/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, startDate, endDate, amount, currency } = req.body;
    
    if (!propertyId || !amount) {
      res.status(400).json({ success: false, error: 'propertyId and amount are required' });
      return;
    }

    // Lookup business based on property
    const { hospitalityService } = await import('../services/hospitalityService');
    const property = await hospitalityService.getPropertyById(propertyId);

    if (!property) {
      res.status(404).json({ success: false, error: 'Property not found' });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Escrow links expire quickly

    const session = await prisma.checkoutSession.create({
      data: {
        businessId: property.businessId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        escrowTerms: { propertyId, startDate, endDate },
        successUrl: `https://pabandi.com/booking/success`,
        cancelUrl: `https://pabandi.com/booking/cancel`,
        metadata: { source: 'ai_receptionist' },
        expiresAt,
        status: 'PENDING'
      }
    });

    const host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkoutUrl = `${host}/checkout/${session.id}`;

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
