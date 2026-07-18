import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
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

    // Default expiry to 24 hours
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

    return res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`
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
    // For now we just return the successUrl with a token

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
