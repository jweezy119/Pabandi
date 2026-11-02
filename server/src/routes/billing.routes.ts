import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { getCreditBalance, applyCreditToInvoice, applyCreditToAmount } from '../services/saasCredit.service';
import { tierDefinition, SUBSCRIPTION_TIERS, PAID_TIERS } from '../config/subscriptions';
import { resolveSquareCredentials, createSquarePaymentLink, squareBaseUrl } from '../services/square-connection.service';
import { getSubscription } from '../services/subscription.service';
import { solanaUsdc } from '../services/solanaUsdc.service';
import { verifySolanaPayment } from '../services/solana-payment-verification.service';

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

// POST /api/v1/billing/subscribe
// Generate a subscription invoice for a target tier with saasCredit pre-applied,
// then create a Square payment link for the net amount. The business pays net
// through Square; on confirm the credit is deducted and the tier is upgraded.
router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const { targetTier } = req.body as { targetTier?: string };
    if (!targetTier || !PAID_TIERS.includes(targetTier as (typeof PAID_TIERS)[number])) {
      return res.status(400).json({
        success: false,
        error: `Invalid target tier. Choose from: ${PAID_TIERS.join(', ')}.`,
      });
    }

    const tier = targetTier as (typeof PAID_TIERS)[number];
    const definition = tierDefinition(tier);
    const monthlyPrice = definition.monthlyPrice;
    if (!monthlyPrice) {
      return res.status(400).json({ success: false, error: 'Tier has no price.' });
    }

    const current = await getSubscription(businessId);
    if (current.tier === tier && current.isPaying) {
      return res.status(400).json({
        success: false,
        error: `Already subscribed to ${tier}.`,
      });
    }

    const amountCents = Math.round(monthlyPrice * 100);
    const creditBalance = await getCreditBalance(businessId);
    const creditBalanceCents = Math.round(creditBalance * 100);
    const creditToApplyCents = Math.min(creditBalanceCents, amountCents);
    const netAmountCents = amountCents - creditToApplyCents;

    // Create the subscription invoice for the target tier (draft until paid).
    // subtotal is the net amount the business actually pays; creditToApply is
    // recorded in metadata and deducted only when payment is confirmed.
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        clientId: await resolveSubscriptionClientId(businessId),
        number: await nextInvoiceNumberForBusiness(businessId),
        dateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'sent',
        lineItems: [{ description: `Upgrade to ${tier} subscription (30 days)`, price: netAmountCents / 100 }],
        subtotal: netAmountCents / 100,
        notes: JSON.stringify({
          text: `Subscription upgrade — ${tier} plan`,
          metadata: {
            invoiceType: 'subscription_upgrade',
            tier,
            creditToApplyCents,
            amountCents,
            netAmountCents,
          },
        }),
      },
    });

    if (netAmountCents <= 0) {
      // Credit covers the full cost — upgrade immediately, no payment needed.
      await applyCreditToInvoice(businessId, invoice.id);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'paid' },
      });
      await prisma.merchantSubscription.upsert({
        where: { businessId },
        create: {
          businessId,
          tier,
          status: 'active',
          priceCents: amountCents,
          currency: 'USD',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          tier,
          status: 'active',
          priceCents: amountCents,
        },
      });
      logger.info(
        `[Billing] Subscription upgrade ${businessId} -> ${tier} fully covered by credit`,
      );
      return res.json({
        success: true,
        data: {
          invoiceId: invoice.id,
          tier,
          amountCents,
          creditAppliedCents: creditToApplyCents,
          netAmountCents: 0,
          paymentRequired: false,
          message: `Upgraded to ${tier} — covered by saas credit.`,
        },
      });
    }

    // Credit doesn't cover the full cost — create a Square payment link for the net.
    const credentials = await resolveSquareCredentials(businessId);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: 'Square not connected. Connect your Square account to pay by card.',
        data: {
          invoiceId: invoice.id,
          tier,
          amountCents,
          creditAppliedCents: creditToApplyCents,
          netAmountCents,
          paymentRequired: true,
          squareRequired: true,
        },
      });
    }

    const link = await createSquarePaymentLink({
      credentials,
      idempotencyKey: `sub-upgrade-${businessId}-${tier}-${invoice.id}`,
      lineItemName: `Pabandi ${tier} subscription (30 days)`,
      amount: netAmountCents / 100,
      currency: 'USD',
      note: `Pabandi subscription upgrade to ${tier}`,
      redirectUrl: `${process.env.CLIENT_URL || 'https://pabandi.com'}/contact/settings/subscription?paid=true&invoice=${invoice.id}`,
      cancelUrl: `${process.env.CLIENT_URL || 'https://pabandi.com'}/contact/settings/subscription?paid=cancelled&invoice=${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        businessId,
        tier,
        orderPurpose: 'subscription_upgrade',
      },
    });

    logger.info(
      `[Billing] Subscription upgrade ${businessId} -> ${tier}: net=$${(netAmountCents / 100).toFixed(2)} credit=$${(creditToApplyCents / 100).toFixed(2)}`,
    );

    return res.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        tier,
        amountCents,
        creditAppliedCents: creditToApplyCents,
        netAmountCents,
        paymentRequired: true,
        paymentUrl: link.url,
        paymentLinkId: link.paymentLinkId,
        orderId: link.orderId,
        message: `Pay $${(netAmountCents / 100).toFixed(2)} via Square to upgrade to ${tier}.`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] subscribe error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/billing/subscribe/solana
// Generate a Solana Pay payment URI for the net subscription amount. The
// business pays USDC to the platform wallet via their own Solana client, then
// POSTs the transaction signature to /subscribe/solana/confirm to complete
// the upgrade. Falls back to a credit-only upgrade when credit covers the
// full cost (no on-chain payment needed).
router.post('/subscribe/solana', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const { targetTier } = req.body as { targetTier?: string };
    if (!targetTier || !PAID_TIERS.includes(targetTier as (typeof PAID_TIERS)[number])) {
      return res.status(400).json({
        success: false,
        error: `Invalid target tier. Choose from: ${PAID_TIERS.join(', ')}.`,
      });
    }

    const tier = targetTier as (typeof PAID_TIERS)[number];
    const definition = tierDefinition(tier);
    const monthlyPrice = definition.monthlyPrice;
    if (!monthlyPrice) {
      return res.status(400).json({ success: false, error: 'Tier has no price.' });
    }

    const current = await getSubscription(businessId);
    if (current.tier === tier && current.isPaying) {
      return res.status(400).json({
        success: false,
        error: `Already subscribed to ${tier}.`,
      });
    }

    const amountCents = Math.round(monthlyPrice * 100);
    const creditBalance = await getCreditBalance(businessId);
    const creditBalanceCents = Math.round(creditBalance * 100);
    const creditToApplyCents = Math.min(creditBalanceCents, amountCents);
    const netAmountCents = amountCents - creditToApplyCents;

    const platformWallet = solanaUsdc.getPlatformWallet();
    if (!platformWallet) {
      return res.status(500).json({
        success: false,
        error: 'Platform Solana wallet not configured. Set PLATFORM_WALLET_ADDRESS.',
      });
    }

    const usdcMint = process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    // Create the pending subscription invoice (paid via Solana Pay).
    const invoice = await prisma.invoice.create({
      data: {
        businessId,
        clientId: await resolveSubscriptionClientId(businessId),
        number: await nextInvoiceNumberForBusiness(businessId),
        dateDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        lineItems: [{ description: `Upgrade to ${tier} subscription (30 days) via Solana Pay`, price: netAmountCents / 100 }],
        subtotal: netAmountCents / 100,
        notes: JSON.stringify({
          text: `Subscription upgrade — ${tier} plan (Solana Pay)`,
          metadata: {
            invoiceType: 'subscription_upgrade_solana',
            tier,
            creditToApplyCents,
            amountCents,
            netAmountCents,
            platformWallet,
            usdcMint,
          },
        }),
      },
    });

    if (netAmountCents <= 0) {
      // Credit covers the full cost — upgrade immediately, no on-chain payment.
      await applyCreditToAmount(businessId, creditToApplyCents);
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'paid' } });
      await prisma.merchantSubscription.upsert({
        where: { businessId },
        create: { businessId, tier, status: 'active', priceCents: amountCents, currency: 'USD', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        update: { tier, status: 'active', priceCents: amountCents },
      });
      logger.info(`[Billing] Solana subscription upgrade ${businessId} -> ${tier} fully covered by credit`);
      return res.json({
        success: true,
        data: { invoiceId: invoice.id, tier, amountCents, creditAppliedCents: creditToApplyCents, netAmountCents: 0, paymentRequired: false, message: `Upgraded to ${tier} — covered by saas credit.` },
      });
    }

    // Build the Solana Pay URI: solana:<wallet>?amount=<usdc>&spl-token=<mint>&label=...&message=<invoiceId>
    const solanaPayUri = `solana:${platformWallet}?amount=${(netAmountCents / 100).toFixed(6)}&spl-token=${usdcMint}&label=${encodeURIComponent(`Pabandi ${tier} subscription`)}&message=${encodeURIComponent(`Invoice ${invoice.number}`)}&reference=${invoice.id}`;

    logger.info(
      `[Billing] Solana subscription upgrade ${businessId} -> ${tier}: net=$${(netAmountCents / 100).toFixed(2)} credit=$${(creditToApplyCents / 100).toFixed(2)}`,
    );

    return res.json({
      success: true,
      data: {
        invoiceId: invoice.id,
        tier,
        amountCents,
        creditAppliedCents: creditToApplyCents,
        netAmountCents,
        paymentRequired: true,
        paymentMethod: 'solana',
        paymentUrl: solanaPayUri,
        platformWallet,
        usdcMint,
        message: `Pay $${(netAmountCents / 100).toFixed(2)} USDC to ${platformWallet} via Solana Pay, then confirm with the transaction signature.`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] subscribe/solana error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/billing/subscribe/solana/confirm
// Verify an on-chain Solana Pay payment for a subscription upgrade, deduct
// saas credit, mark the invoice paid, and upgrade the merchant tier.
router.post('/subscribe/solana/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const { invoiceId, signature } = req.body as { invoiceId?: string; signature?: string };
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice required' });
    }
    if (!signature) {
      return res.status(400).json({ success: false, error: 'Transaction signature required' });
    }

    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, businessId } });
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    if (invoice.status === 'paid') {
      return res.json({ success: true, data: { alreadyPaid: true } });
    }

    const notes = JSON.parse(invoice.notes || '{}');
    const metadata = notes.metadata || {};
    const tier = metadata.tier;
    const creditToApplyCents = Number(metadata.creditToApplyCents ?? 0);
    const netAmountCents = Number(metadata.netAmountCents ?? 0);
    const expectedRecipient = metadata.platformWallet || solanaUsdc.getPlatformWallet();
    const claimedAmountUsdc = netAmountCents / 100;

    if (!expectedRecipient) {
      return res.status(500).json({ success: false, error: 'Platform wallet not configured on invoice.' });
    }

    // Verify the on-chain payment: signature, success, expected recipient, amount.
    const verification = await verifySolanaPayment({
      signature,
      claimedAmount: claimedAmountUsdc,
      expectedRecipient,
    });

    if (!verification.ok) {
      return res.status(400).json({ success: false, error: `Payment verification failed: ${verification.reason}` });
    }

    // Deduct saas credit and mark the invoice paid.
    if (creditToApplyCents > 0) {
      await applyCreditToAmount(businessId, creditToApplyCents);
    }
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });

    // Upgrade the merchant tier.
    const amountCents = Number(metadata.amountCents ?? 0);
    await prisma.merchantSubscription.upsert({
      where: { businessId },
      create: { businessId, tier, status: 'active', priceCents: amountCents, currency: 'USD', currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      update: { tier, status: 'active', priceCents: amountCents },
    });

    logger.info(
      `[Billing] Solana subscription confirmed ${businessId} -> ${tier}: sig=${signature} credit=${creditToApplyCents}c invoice=${invoiceId}`,
    );

    return res.json({
      success: true,
      data: { invoiceId, tier, creditAppliedCents: creditToApplyCents, paid: true, message: `Upgraded to ${tier} via Solana Pay.` },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] subscribe/solana/confirm error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

// POST /api/v1/billing/subscription/confirm
// Verify a Square payment for a subscription upgrade, deduct saas credit,
// mark the invoice paid, and upgrade the merchant tier.
router.post('/subscription/confirm', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'Business required' });
    }

    const { invoiceId, orderId } = req.body as { invoiceId?: string; orderId?: string };
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice required' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
    });
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    if (invoice.status === 'paid') {
      return res.json({ success: true, data: { alreadyPaid: true, tier: (invoice.notes as any)?.metadata?.tier } });
    }

    const notes = JSON.parse(invoice.notes || '{}');
    const metadata = notes.metadata || {};
    const tier = metadata.tier;
    const creditToApplyCents = metadata.creditToApplyCents ?? 0;
    const squareOrderId = orderId || metadata.squareOrderId;

    // Verify Square payment if an order exists.
    if (squareOrderId) {
      const credentials = await resolveSquareCredentials(businessId);
      if (!credentials) {
        return res.status(404).json({ success: false, error: 'Square not connected.' });
      }
      const orderRes = await fetch(`${squareBaseUrl()}/v2/orders/${squareOrderId}`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2026-09-16',
        },
      });
      if (!orderRes.ok) {
        return res.status(400).json({ success: false, error: 'Could not verify Square payment.' });
      }
      const order = await orderRes.json();
      const state = order.order?.state;
      const tenders = order.order?.tenders ?? [];
      const paid = state === 'COMPLETED' || tenders.length > 0;
      if (!paid) {
        return res.status(400).json({ success: false, error: 'Payment not yet received. Complete the Square checkout first.' });
      }
    }

    // Deduct saas credit and mark the invoice paid.
    if (creditToApplyCents > 0) {
      await applyCreditToAmount(businessId, creditToApplyCents);
    }
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'paid' },
    });

    // Upgrade the merchant tier.
    const amountCents = metadata.amountCents ?? 0;
    await prisma.merchantSubscription.upsert({
      where: { businessId },
      create: {
        businessId,
        tier,
        status: 'active',
        priceCents: amountCents,
        currency: 'USD',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        tier,
        status: 'active',
        priceCents: amountCents,
      },
    });

    logger.info(
      `[Billing] Subscription confirmed ${businessId} -> ${tier}: credit=${creditToApplyCents}c invoice=${invoiceId}`,
    );

    return res.json({
      success: true,
      data: {
        invoiceId,
        tier,
        creditAppliedCents: creditToApplyCents,
        paid: true,
        message: `Upgraded to ${tier}.`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Billing] subscription confirm error:', message);
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
