import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import { safepayService } from '../services/safepay.service';

export const createPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reservationId, amount, paymentMethod } = req.body;

    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new CustomError('Reservation not found', 404);
      }

      if (reservation.customerId !== req.user!.id) {
        throw new CustomError('Unauthorized', 403);
      }
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        reservationId,
        userId: req.user!.id,
        amount,
        paymentMethod: paymentMethod || 'credit_card',
        status: 'PENDING',
      },
    });

    // Integrate with Safepay
    let paymentUrl = `/payment/process/${payment.id}`;
    if (paymentMethod === 'safepay') {
      try {
        const checkoutReference = `pay_${payment.id}`;
        paymentUrl = await safepayService.createCheckoutUrl(amount, checkoutReference);
        await prisma.payment.update({
          where: { id: payment.id },
          data: { gatewayResponse: { ...(payment.gatewayResponse as any || {}), safepayReference: checkoutReference } },
        });
      } catch (err) {
        logger.error(`Safepay initialization failed: ${err}`);
      }
    }

    logger.info(`Payment created: ${payment.id} via ${paymentMethod}`);

    res.status(201).json({
      success: true,
      message: 'Payment initiated',
      data: {
        payment: {
          ...payment,
          paymentUrl,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        reservation: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!payment) {
      throw new CustomError('Payment not found', 404);
    }

    // Check authorization
    if (
      req.user!.role !== UserRole.ADMIN &&
      payment.userId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    res.json({
      success: true,
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};

export const createSubscriptionCheckout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId, amount, planName } = req.body as {
      planId?: string;
      amount: number;
      planName?: string;
    };

    if (!amount || amount <= 0) {
      throw new CustomError('A valid subscription amount is required', 400);
    }

    const reference = `sub_${planId || 'custom'}_${Date.now()}`;

    const checkoutUrl = await safepayService.createApiSubscriptionCheckoutUrl(amount, reference);

    const payment = await prisma.payment.create({
      data: {
        userId: req.user!.id,
        amount,
        paymentMethod: 'safepay',
        status: 'PENDING',
        gatewayResponse: { planId, planName, reference },
      },
    });

    res.status(201).json({
      success: true,
      data: { checkoutUrl, payment },
    });
  } catch (error) {
    next(error);
  }
};

export const processPaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['x-sfpy-signature'] as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});
    const isValid = safepayService.verifyWebhook(signature, rawBody);

    if (!isValid) {
      logger.error('Invalid Safepay webhook signature');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = req.body || {};
    const { tracker, reference, state } = payload;
    const mappedStatus = mapSafePayState(state);

    if (!reference) {
      return res.status(400).json({ success: false, message: 'Missing reference' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: String(reference) },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
    const isTerminal = terminalStatuses.includes(payment.status as any);

    const updates: any = {
      gatewayResponse: {
        ...((payment.gatewayResponse as Record<string, unknown>) || {}),
        safepay: payload,
      },
    };

    if (!isTerminal) {
      updates.status = mappedStatus;
      if (tracker) updates.transactionId = String(tracker);
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: updates,
    });

    if (mappedStatus === 'COMPLETED' && payment.status !== 'COMPLETED') {
      const fee = +(updated.amount * 0.03).toFixed(2);
      await prisma.payment.update({
        where: { id: updated.id },
        data: { platformFeeAmount: fee, platformFeeStatus: 'CAPTURED' },
      });

      if (updated.reservationId) {
        await prisma.reservation.update({
          where: { id: updated.reservationId },
          data: { depositPaid: true },
        });
      }
    }

    logger.info(`Payment webhook processed: ${updated.id} - ${updated.status}`);

    res.json({ success: true, status: updated.status });
  } catch (error) {
    next(error);
  }
};

function mapSafePayState(state: unknown): string {
  const normalized = String(state || '').toLowerCase();
  if (normalized === 'completed') return 'COMPLETED';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'CANCELLED';
  return 'FAILED';
}
