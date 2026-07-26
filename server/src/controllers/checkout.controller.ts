import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { stripeService } from '../services/stripe.service';
import { safepayService } from '../services/safepay.service';
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
    return ok(res, { sessionId: session.id, checkoutUrl }, 201);
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

    return ok(res, session);
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
        const providerUrlCandidate = await safepayService.createCheckoutUrl(amount, session.id);
        providerUrl = providerUrlCandidate;
        gateway = 'safepay';
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

    if (!partnerBusinessId && !businessId) {
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
        const providerUrlCandidate = await safepayService.createCheckoutUrl(amount, session.id);
        providerUrl = providerUrlCandidate;
        gateway = 'safepay';
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
