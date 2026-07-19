import { Router } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { apiKeyAuth, logApiUsage, ApiKeyRequest } from '../middleware/apiKey.middleware';

const router = Router();

// Apply API Key authentication and usage logging to all public API routes
router.use(apiKeyAuth as any);
router.use(logApiUsage as any);

/**
 * POST /api/v1/public/escrow/create
 * Creates an Escrow Checkout Session (Hosted Payment Link).
 * This allows 3rd party apps to redirect users to Pabandi to securely fund an escrow.
 */
router.post('/escrow/create', async (req: ApiKeyRequest, res, next) => {
  try {
    const { amount, currency = 'USD', escrowTerms, successUrl, cancelUrl, metadata } = req.body;
    const businessId = req.apiClient?.businessId;

    if (!businessId) {
      return res.status(403).json({ success: false, error: 'API Key is not associated with a Business account' });
    }

    if (!amount || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields: amount, successUrl, cancelUrl' });
    }

    // Default expiry to 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await prisma.checkoutSession.create({
      data: {
        businessId,
        amount: parseFloat(amount),
        currency,
        escrowTerms: escrowTerms || {},
        successUrl,
        cancelUrl,
        metadata: metadata || {},
        expiresAt,
        status: 'PENDING'
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    logger.error('Error creating public escrow session:', error);
    return res.status(500).json({ success: false, error: 'Failed to create escrow session' });
  }
});

export default router;
