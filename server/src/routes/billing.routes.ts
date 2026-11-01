import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/billing/checkout
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tier, paymentMethod } = req.body as { tier: 'pro' | 'business'; paymentMethod: 'square' | 'solana' };
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const prices = {
      pro: 49,
      business: 149,
    };

    const amount = prices[tier];

    if (paymentMethod === 'square') {
      // Generate Square checkout link (placeholder)
      const checkoutUrl = `https://checkout.square.site/merchant/placeholder/checkout?amount=${amount * 100}&currency=USD&reference=${businessId}-${tier}`;
      return res.json({
        success: true,
        data: {
          checkoutUrl,
          paymentMethod: 'square',
          amount,
          tier,
        },
      });
    } else if (paymentMethod === 'solana') {
      // Generate Solana Pay link (placeholder)
      const checkoutUrl = `solana:${process.env.SOLANA_MERCHANT_WALLET}?amount=${amount}&label=Pabandi%20${tier}%20Subscription`;
      return res.json({
        success: true,
        data: {
          checkoutUrl,
          paymentMethod: 'solana',
          amount,
          tier,
        },
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid payment method' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] checkout error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/billing/webhook
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { eventType, subscriptionId, businessId, tier, status } = req.body;

    if (eventType === 'subscription.updated' || eventType === 'payment.succeeded') {
      await prisma.merchantSubscription.upsert({
        where: { businessId },
        create: {
          businessId,
          tier: tier || 'pro',
          status: 'active',
          whopMembershipId: subscriptionId,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          tier: tier || 'pro',
          status: status || 'active',
          whopMembershipId: subscriptionId,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`[Billing] Subscription updated for business ${businessId}: ${tier}`);
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] webhook error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// GET /api/v1/billing/subscription
router.get('/subscription', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const subscription = await prisma.merchantSubscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      const created = await prisma.merchantSubscription.create({
        data: {
          businessId,
          tier: 'free',
          status: 'active',
        },
      });
      return res.json({ success: true, data: created });
    }

    return res.json({ success: true, data: subscription });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] get subscription error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;

// Dodo checkout
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tier } = req.body as { tier: 'pro' | 'business' };
    const userId = req.user?.id;
    const email = req.user?.email;

    if (!userId || !email) {
      return res.status(400).json({ success: false, error: 'User required' });
    }

    if (tier !== 'pro' && tier !== 'business') {
      return res.status(400).json({ success: false, error: 'Invalid tier' });
    }

    const { dodoService } = await import('../services/dodo.service');
    const result = await dodoService.createCheckoutSession(userId, email, tier);

    if (!result.success || !result.checkoutUrl) {
      return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
    }

    return res.json({ success: true, url: result.checkoutUrl, checkoutUrl: result.checkoutUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] dodo checkout error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// Dodo webhook
router.post('/webhook/dodo', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    
    if (event.type === 'subscription.active' || event.type === 'subscription.renewed') {
      const metadata = event.data?.metadata || {};
      const businessId = metadata.businessId || event.data?.customer?.metadata?.businessId;
      const tier = metadata.tier || 'pro';
      
      if (businessId) {
        await prisma.merchantSubscription.upsert({
          where: { businessId },
          create: {
            businessId,
            tier,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            tier,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        logger.info(`[Dodo Webhook] Subscription activated for ${businessId}: ${tier}`);
      }
    } else if (event.type === 'subscription.cancelled') {
      const metadata = event.data?.metadata || {};
      const businessId = metadata.businessId || event.data?.customer?.metadata?.businessId;
      
      if (businessId) {
        await prisma.merchantSubscription.update({
          where: { businessId },
          data: { status: 'canceled' },
        });
        logger.info(`[Dodo Webhook] Subscription cancelled for ${businessId}`);
      }
    }

    return res.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Dodo Webhook] error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});
