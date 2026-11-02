import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { getCreditBalance, applyCreditToInvoice } from '../services/saasCredit.service';
import { tierDefinition, SUBSCRIPTION_TIERS, PAID_TIERS } from '../config/subscriptions';

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

// GET /api/v1/billing/credit-balance
// The business's current saasCreditBalance — yield credit earned from Solana
// escrow releases that pays for their next subscription invoice.
router.get('/credit-balance', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const balance = await getCreditBalance(businessId);
    return res.json({ success: true, data: { saasCreditBalance: balance } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] credit-balance error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/billing/subscription-invoice
// Generate a subscription invoice for the caller's current tier, with
// saasCreditBalance pre-applied. The business pays netAmountCents through
// their normal payment rail (Square / Solana Pay / etc. — never Stripe).
router.post('/subscription-invoice', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const subscription = await prisma.merchantSubscription.findUnique({
      where: { businessId },
    });

    const tier = subscription?.tier ?? 'free';
    const definition = tierDefinition(tier);
    const monthlyPrice = definition.monthlyPrice;

    if (!monthlyPrice || !PAID_TIERS.includes(tier as (typeof PAID_TIERS)[number])) {
      return res.status(400).json({
        success: false,
        error: `No paid subscription to invoice (current tier: ${tier}).`,
      });
    }

    const amountCents = Math.round(monthlyPrice * 100);

    // Create the subscription invoice (draft until paid).
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        // Subscription invoices carry no client — they are business-owned.
        clientId: await resolveSubscriptionClientId(businessId),
        number: await nextInvoiceNumberForBusiness(businessId),
        dateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'sent',
        lineItems: [{ description: `${tier} subscription (30 days)`, price: monthlyPrice }],
        subtotal: monthlyPrice,
        notes: JSON.stringify({
          text: `Subscription invoice — ${tier} plan`,
          metadata: { invoiceType: 'subscription', tier },
        }),
      },
    });

    // Pre-apply saasCreditBalance so the business sees the net amount they owe.
    let creditAppliedCents = 0;
    let netAmountCents = amountCents;
    try {
      const { application } = await applyCreditToInvoice(businessId, invoice.id);
      creditAppliedCents = application.creditAppliedCents;
      netAmountCents = application.netAmountCents;
    } catch (err) {
      logger.warn(
        `[Billing] saasCredit pre-apply failed for subscription invoice ${invoice.id}: ${err instanceof Error ? err.message : err}`
      );
    }

    logger.info(
      `[Billing] Subscription invoice ${invoice.number} for business ${businessId}: ` +
        `tier=${tier} subtotal=$${(amountCents / 100).toFixed(2)} credit=$${(creditAppliedCents / 100).toFixed(2)} net=$${(netAmountCents / 100).toFixed(2)}`
    );

    return res.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        number: invoice.number,
        tier,
        subtotalCents: amountCents,
        creditAppliedCents,
        netAmountCents,
        currency: 'USD',
        dateDue: invoice.dateDue,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] subscription-invoice error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * Resolve a CrmClient for subscription invoices. Subscription invoices are
 * business-owned (no real client), but Invoice.clientId is required. We use
 * the business's own enrolled service-business as a placeholder client so the
 * FK resolves.
 */
async function resolveSubscriptionClientId(businessId: string): Promise<string> {
  const serviceBusiness = await prisma.crmServiceBusiness.findUnique({
    where: { businessId },
    select: { id: true },
  });

  if (!serviceBusiness) {
    throw new Error(`No enrolled service business for ${businessId}; cannot create subscription invoice`);
  }

  const existing = await prisma.crmClient.findFirst({
    where: { serviceBusinessId: serviceBusiness.id },
    select: { id: true },
  });

  if (existing) return existing.id;

  // Create a placeholder client representing "this business" for subscription invoices.
  const created = await prisma.crmClient.create({
    data: {
      serviceBusinessId: serviceBusiness.id,
      name: 'Platform Subscription',
      email: null,
      phone: null,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Allocate the next invoice number scoped per business and year.
 */
async function nextInvoiceNumberForBusiness(businessId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-SUB-`;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const count = await prisma.invoice.count({
      where: { businessId, number: { startsWith: prefix } },
    });
    const number = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
    const clash = await prisma.invoice.findUnique({ where: { number }, select: { id: true } });
    if (!clash) return number;
  }

  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}
