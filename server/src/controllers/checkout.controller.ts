import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

// Create a new checkout session (Hosted Payment Link)
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { businessId, amount, currency, escrowTerms, successUrl, cancelUrl, metadata } = req.body;

    if (!businessId || !amount || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields for checkout session' });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
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
    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl
      }
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
};

// Retrieve a checkout session for the buyer UI
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
      return res.status(404).json({ success: false, error: 'Checkout session not found' });
    }

    if (new Date() > new Date(session.expiresAt) && session.status === 'PENDING') {
      await prisma.checkoutSession.update({
        where: { id },
        data: { status: 'EXPIRED' }
      });
      session.status = 'EXPIRED';
    }

    return res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Error fetching checkout session:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch checkout session' });
  }
};

// Complete/Simulate payment for the checkout session
export const completeCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const session = await prisma.checkoutSession.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Checkout session not found' });
    }

    if (session.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `Session is already ${session.status}` });
    }

    const updatedSession = await prisma.checkoutSession.update({
      where: { id },
      data: { status: 'PAID' }
    });

    // Here we would typically trigger webhooks or create a Reservation/Escrow record
    // For A5: Hook escrow payment webhook -> AI confirmation template
    if ((updatedSession.metadata as any)?.source === 'ai_receptionist') {
      try {
        const { openwaTemplateService } = await import('../services/openwa.template.service');
        const { openwaService } = await import('../services/openwa.service');
        
        // This relies on knowing the customer's phone, which might be stored in metadata.
        // For MVP, we'll try to find the reservation or fallback to a dummy number.
        const customerPhone = (updatedSession.metadata as any)?.customerPhone || '+1234567890';
        
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
    
    // For B5: Add optional $PAB seller-funded incentive logic
    if ((updatedSession.metadata as any)?.source === 'drop_bot_buy') {
      try {
        const pabReward = Math.floor(updatedSession.amount * 0.1); // 10% back in PAB
        logger.info(`[Drop Engine] Issued ${pabReward} $PAB reward to buyer for drop purchase (Session ${updatedSession.id})`);
        
        // Mocking the auto-deduct from seller treasury
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

    const redirectUrl = new URL(updatedSession.successUrl);
    redirectUrl.searchParams.append('session_id', updatedSession.id);
    redirectUrl.searchParams.append('status', 'success');

    return res.json({
      success: true,
      data: {
        redirectUrl: redirectUrl.toString()
      }
    });
  } catch (error) {
    logger.error('Error completing checkout session:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete checkout session' });
  }
};

export const createEmbedCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;

    if (!businessId || !amount || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields for embed checkout session' });
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
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
    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl,
      },
    });
  } catch (error) {
    logger.error('Error creating embed checkout session:', error);
    return res.status(500).json({ success: false, error: 'Failed to create embed checkout session' });
  }
};

export const createPartnerEmbedCheckoutSession = async (req: any, res: Response) => {
  try {
    const apiClient = req.apiClient;
    const partnerBusinessId = apiClient?.businessId;

    const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;

    if (!partnerBusinessId && !businessId) {
      return res.status(400).json({ success: false, error: 'Missing businessId or partner API key business context' });
    }
    if (!amount || !successUrl || !cancelUrl) {
      return res.status(400).json({ success: false, error: 'Missing required fields for embed checkout session' });
    }

    const targetBusinessId = businessId || partnerBusinessId as string;
    const business = await prisma.business.findUnique({ where: { id: targetBusinessId } });
    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
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
    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl,
      },
    });
  } catch (error) {
    logger.error('Error creating partner embed checkout session:', error);
    return res.status(500).json({ success: false, error: 'Failed to create partner embed checkout session' });
  }
};
