import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { stripeService } from '../services/stripe.service';
import { safepayService } from '../services/safepay.service';
import { escrowService } from '../services/escrow.service';
import { fail, ok } from '../utils/apiResponse';

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { businessId, amount, currency, escrowTerms, successUrl, cancelUrl, metadata } = req.body;

    if (!businessId || !amount || !successUrl || !cancelUrl) {
      return fail(res, 'Missing required fields for checkout session', 400);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return fail(res, 'Business not found', 404);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await prisma.checkoutSession.create({
      data: {
        businessId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        escrowTerms: escrowTerms || {},
        successUrl,
        cancelUrl,
        metadata: metadata || {},
        expiresAt,
        status: 'PENDING'
      }
    });

    const host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkoutUrl = `${host}/checkout/${session.id}`;

    let gateway = 'UNIVERSAL';
    let providerUrl: string | undefined;
    if (business.currency === 'PKR') {
      try {
        const checkoutReference = `cs_${session.id}`;
        providerUrl = await safepayService.createCheckoutUrl(amount, checkoutReference);
        gateway = 'safepay';
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
        });
      } catch {
        providerUrl = checkoutUrl;
      }
    }

    if (providerUrl && providerUrl !== checkoutUrl) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { metadata: { ...(metadata || {}), gateway, providerUrl } },
      });
    }

    return ok(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return fail(res, 'Failed to create checkout session', 500);
  }
};

export const getCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            trustScore: true,
            isVerified: true
          }
        }
      }
    });

    if (!session) {
      return fail(res, 'Checkout session not found', 404);
    }

    if (new Date() > new Date(session.expiresAt) && session.status === 'PENDING') {
      await prisma.checkoutSession.update({
        where: { id },
        data: { status: 'EXPIRED' }
      });
      session.status = 'EXPIRED';
    }

    const metadata = (session.metadata as any) || {};
    const responsePayload: any = session;
    if (metadata.gateway) responsePayload.gateway = metadata.gateway;
    if (metadata.providerUrl) responsePayload.providerUrl = metadata.providerUrl;

    return ok(res, responsePayload);
  } catch (error) {
    logger.error('Error fetching checkout session:', error);
    return fail(res, 'Failed to fetch checkout session', 500);
  }
};

export const completeCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id }
    });

    if (!session) {
      return fail(res, 'Checkout session not found', 404);
    }

    if (session.status !== 'PENDING') {
      return fail(res, `Session is already ${session.status}`, 400);
    }

    const updatedSession = await prisma.checkoutSession.update({
      where: { id },
      data: { status: 'PAID' }
    });

    if ((updatedSession.metadata as any)?.source === 'ai_receptionist') {
      try {
        const { openwaTemplateService } = await import('../services/openwa.template.service');
        const customerPhone = (updatedSession.metadata as any)?.customerPhone || '+123****7890';

        await openwaTemplateService.sendTemplate(customerPhone, 'deposit_receipt', {
          customerName: 'Guest',
          businessName: 'Pabandi Property',
          amount: `${updatedSession.amount} ${updatedSession.currency}`,
          reservationDate: 'Confirmed Date',
          reservationTime: 'Confirmed Time'
        });
      } catch (err) {
        logger.error('Failed to send WhatsApp deposit receipt:', err);
      }
    }

    if ((updatedSession.metadata as any)?.source === 'drop_bot_buy') {
      try {
        const pabReward = Math.floor(updatedSession.amount * 0.1);
        logger.info(`[Drop Engine] Issued ${pabReward} $PAB reward to buyer for drop purchase (Session ${updatedSession.id})`);

        await prisma.checkoutSession.update({
          where: { id },
          data: {
            metadata: {
              ...(updatedSession.metadata as any),
              pabReward,
              rewardStatus: 'ISSUED'
            }
          }
        });
      } catch (err) {
        logger.error('Failed to issue $PAB reward:', err);
      }
    }

    try {
      const { yieldService } = await import('../services/yield.service');
      const tier = updatedSession.amount > 1000 ? 'INSTITUTIONAL' : 'RETAIL';

      const stakingPos = await yieldService.orchestrateStaking(
        updatedSession.amount,
        updatedSession.currency,
        tier
      );

      await prisma.checkoutSession.update({
        where: { id },
        data: {
          metadata: {
            ...(updatedSession.metadata as any),
            yieldPositionId: stakingPos.id,
            yieldStatus: stakingPos.status
          }
        }
      });
    } catch (err) {
      logger.error('Failed to orchestrate staking yield:', err);
    }

    const redirectUrl = new URL(updatedSession.successUrl);
    redirectUrl.searchParams.append('session_id', updatedSession.id);
    redirectUrl.searchParams.append('status', 'success');

    return ok(res, { redirectUrl: redirectUrl.toString() });
  } catch (error) {
    logger.error('Error completing checkout session:', error);
    return fail(res, 'Failed to complete checkout session', 500);
  }
};

export const createEmbedCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;

    if (!businessId || !amount || !successUrl || !cancelUrl) {
      return fail(res, 'Missing required fields for embed checkout session', 400);
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return fail(res, 'Business not found', 404);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await prisma.checkoutSession.create({
      data: {
        businessId,
        amount: parseFloat(amount),
        currency: currency || business.currency || 'USD',
        source: source || 'UNIVERSAL',
        escrowTerms: escrowTerms || null,
        metadata: metadata || null,
        successUrl,
        cancelUrl,
        expiresAt,
        status: 'PENDING',
      },
    });

    const host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkoutUrl = `${host}/checkout/${session.id}`;

    let gateway = 'UNIVERSAL';
    let providerUrl: string | undefined;
    if (business.currency === 'PKR') {
      try {
        const checkoutReference = `cs_${session.id}`;
        providerUrl = await safepayService.createCheckoutUrl(amount, checkoutReference);
        gateway = 'safepay';
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
        });
      } catch {
        providerUrl = checkoutUrl;
      }
    }

    if (providerUrl && providerUrl !== checkoutUrl) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          metadata: { ...(metadata || {}), gateway, providerUrl },
        },
      });
    }

    return ok(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
  } catch (error) {
    logger.error('Error creating embed checkout session:', error);
    return fail(res, 'Failed to create embed checkout session', 500);
  }
};

export const createPartnerEmbedCheckoutSession = async (req: any, res: Response) => {
  try {
    const apiClient = req.apiClient;
    const partnerBusinessId = apiClient?.businessId;

    const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;

    if (!partnerBusinessId || !businessId) {
      return fail(res, 'Missing businessId or partner API key business context', 400);
    }
    if (!amount || !successUrl || !cancelUrl) {
      return fail(res, 'Missing required fields for embed checkout session', 400);
    }

    const targetBusinessId = businessId || partnerBusinessId as string;
    const business = await prisma.business.findUnique({ where: { id: targetBusinessId } });
    if (!business) {
      return fail(res, 'Business not found', 404);
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const session = await prisma.checkoutSession.create({
      data: {
        businessId: targetBusinessId,
        amount: parseFloat(amount),
        currency: currency || business.currency || 'USD',
        source: source || 'UNIVERSAL',
        escrowTerms: escrowTerms || null,
        metadata: metadata || null,
        successUrl,
        cancelUrl,
        expiresAt,
        status: 'PENDING',
      },
    });

    const host = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkoutUrl = `${host}/checkout/${session.id}`;

    let gateway = 'UNIVERSAL';
    let providerUrl: string | undefined;
    if (business.currency === 'PKR') {
      try {
        const checkoutReference = `cs_${session.id}`;
        providerUrl = await safepayService.createCheckoutUrl(amount, checkoutReference);
        gateway = 'safepay';
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
        });
      } catch {
        providerUrl = checkoutUrl;
      }
    }

    if (providerUrl && providerUrl !== checkoutUrl) {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          metadata: { ...(metadata || {}), gateway, providerUrl },
        },
      });
    }

    return ok(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
  } catch (error) {
    logger.error('Error creating partner embed checkout session:', error);
    return fail(res, 'Failed to create partner embed checkout session', 500);
  }
};

export const initiateStripeCheckout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id },
      include: { business: true }
    });

    if (!session || session.status !== 'PENDING') {
      return fail(res, 'Valid checkout session not found', 404);
    }

    const amountCents = Math.round(session.amount * 100);

    const stripeUrl = await stripeService.createCheckoutUrl(
      amountCents,
      session.currency,
      session.id,
      session.successUrl,
      session.cancelUrl,
      session.business.stripeAccountId || undefined
    );

    return ok(res, { url: stripeUrl });
  } catch (error: any) {
    logger.error('Error initiating Stripe checkout', error);
    return fail(res, 'Internal server error', 500);
  }
};

export const initiateCryptoCheckout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!session || session.status !== 'PENDING') {
      return fail(res, 'Valid checkout session not found', 404);
    }

    const mint = process.env.USDC_MINT_DEVNET || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtCJr';
    const treasury =
      process.env.TAP_TREASURY ||
      process.env.NEXT_PUBLIC_PLATFORM_WALLET ||
      process.env.PLATFORM_WALLET_ADDRESS ||
      '';

    // persist crypto gateway so frontend shows the USDC button
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { metadata: { ...(session.metadata as any || {}), gateway: 'crypto' } },
    });

    return ok(res, {
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`,
      gateway: 'crypto',
      currency: session.currency || 'USD',
      amount: session.amount,
      mint,
      treasury,
      reservationId: session.id,
      businessId: session.businessId,
    }, 201);
  } catch (error: any) {
    logger.error('Error initiating crypto checkout', error);
    return fail(res, 'Internal server error', 500);
  }
};

export const initiateEscrowCheckout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { buyerEmail, sellerEmail } = req.body;

    if (!process.env.ESCROW_API_EMAIL || !process.env.ESCROW_API_KEY) {
      return fail(res, 'Escrow.com checkout is unavailable right now.', 503);
    }

    const session = await prisma.checkoutSession.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!session || session.status !== 'PENDING') {
      return fail(res, 'Valid checkout session not found', 404);
    }

    const description = session.escrowTerms
      ? `Escrow session ${id}`
      : `Pabandi escrow session ${id}`;
    const title = `Reservation ${id}`;

    const result = await escrowService.createTransaction({
      amount: session.amount,
      currency: session.currency,
      buyerEmail: buyerEmail || session.successUrl.replace(/.*\/\//, '').split('/')[0] || 'buyer@pabandi.com',
      sellerEmail: sellerEmail || 'seller@pabandi.com',
      description,
      itemTitle: title,
      reference: id,
    });

    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        metadata: {
          ...(session.metadata as any || {}),
          gateway: 'escrow',
          escrowTransactionId: result.id,
          providerUrl: result.url,
        },
      },
    });

    return ok(res, {
      url: result.url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${id}`,
      gateway: 'escrow',
      currency: session.currency || 'USD',
      amount: session.amount,
      reservationId: id,
      businessId: session.businessId,
      transactionId: result.id,
    }, 201);
  } catch (error: any) {
    logger.error('Error initiating escrow checkout', error);
    return fail(res, 'Internal server error', 500);
  }
};

export const getCheckoutReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!session) {
      return fail(res, 'Checkout session not found', 404);
    }

    const events = await prisma.escrowEvent.findMany({
      where: { checkoutSessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    const latestEvent = events[events.length - 1] || null;
    const metadata = (session.metadata as any) || {};
    const transactionId = metadata.escrowTransactionId || metadata.transactionId || null;

    const statusLabel =
      session.status === 'PAID'
        ? 'Payment confirmed'
        : session.status === 'FUNDED'
          ? 'Funds secured in escrow'
          : session.status === 'RELEASED'
            ? 'Funds released to seller'
            : session.status === 'CANCELLED'
              ? 'Transaction cancelled'
              : session.status === 'DISPUTED'
                ? 'Dispute opened'
                : session.status === 'EXPIRED'
                  ? 'Session expired'
                  : 'Awaiting payment';

    const receipt = {
      sessionId: session.id,
      businessName: session.business?.name || 'Pabandi',
      amount: session.amount,
      currency: session.currency,
      status: session.status,
      statusLabel,
      gateway: metadata.gateway || 'UNIVERSAL',
      providerUrl: metadata.providerUrl || null,
      transactionId,
      webhookUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${id}`,
      eventCount: events.length,
      lastEvent: latestEvent,
      events,
      updatedAt: session.updatedAt,
    };

    return ok(res, { receipt });
  } catch (error: any) {
    logger.error('Error fetching checkout receipt', error);
    return fail(res, 'Failed to fetch receipt', 500);
  }
};

export const createDemoCheckoutSession = async (_req: Request, res: Response) => {
  try {
    const demoBusinessId = 'cms28eons000k2358v5n5y9o9';
    const amount = 5000;
    const currency = 'USD';
    const escrowConfigured = Boolean(process.env.ESCROW_API_EMAIL && process.env.ESCROW_API_KEY);
    const gateway = escrowConfigured ? 'escrow' : 'stripe';

    const session = await prisma.checkoutSession.create({
      data: {
        businessId: demoBusinessId,
        amount,
        currency,
        source: 'UNIVERSAL',
        successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/demo`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/demo`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          source: 'demo',
          gateway,
          ...(gateway === 'escrow' ? { rails: ['escrow'] } : {}),
        },
      },
    });

    return ok(res, {
      sessionId: session.id,
      checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`,
      gateway,
      currency,
      amount,
    }, 201);
  } catch (error: any) {
    logger.error('Error creating demo checkout session', error);
    return fail(res, 'Internal server error', 500);
  }
};
