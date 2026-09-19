import { Request, Response, NextFunction } from 'express';
import { squareService } from '../services/squareCheckout.service';
import { prisma } from '../utils/database';

export const createSquareCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referenceId, amount, currency, redirectUrl, cancelUrl, note, customerEmail } = req.body;
    
    const checkout = await squareService.createCheckout({
      referenceId,
      amount: Math.round(amount * 100), // convert dollars to cents
      currency: currency || 'USD',
      redirectUrl,
      cancelUrl,
      note,
      customerEmail,
    });

    res.json({ success: true, checkout });
  } catch (err) {
    next(err);
  }
};

export const getSquarePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const payment = await squareService.getPayment(paymentId);
    res.json({ success: true, payment });
  } catch (err) {
    next(err);
  }
};

export const handleSquareWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = JSON.stringify(req.body);
    const signature = req.headers['x-square-signature'] as string;
    const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    const isValid = await squareService.verifyWebhook(body, signature, webhookUrl);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const result = await squareService.processWebhook(req.body);
    
    // Update payment status in DB based on webhook
    if (result.type === 'PAYMENT_UPDATED' && result.status === 'COMPLETED') {
      // Find payment by Square payment ID and update status
      const payment = await prisma.payment.findUnique({
        where: { transactionId: result.paymentId },
      });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED' },
        });
        // Also mark reservation deposit as paid
        if (payment.reservationId) {
          await prisma.reservation.update({
            where: { id: payment.reservationId },
            data: { depositPaid: true },
          });
        }
      }
    }

    res.json({ received: true, result });
  } catch (err) {
    next(err);
  }
};

export const createSquareRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId, amount, reason } = req.body;
    const refund = await squareService.createRefund(paymentId, Math.round(amount * 100), reason);
    res.json({ success: true, refund });
  } catch (err) {
    next(err);
  }
};
