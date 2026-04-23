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
        paymentUrl = await safepayService.createCheckoutUrl(amount, reservationId || payment.id);
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

export const processPaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['x-sfpy-signature'] as string;
    const isValid = safepayService.verifyWebhook(signature, req.body);

    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.error('Invalid Safepay webhook signature');
      throw new CustomError('Invalid signature', 401);
    }

    const { tracker, reference, state } = req.body;
    
    // Safepay states: 'completed', 'failed', 'cancelled'
    const status: any = state === 'completed' ? 'COMPLETED' : 
                   state === 'failed' ? 'FAILED' : 'FAILED'; // Use FAILED for cancelled payments too if not in enum

    const payment = await prisma.payment.update({
      where: { id: reference }, // In Safepay we use reference for payment/reservation ID
      data: {
        status: status,
        transactionId: tracker,
        gatewayResponse: req.body,
      },
    });

    // If deposit payment completed, update reservation
    if (payment.reservationId && status === 'COMPLETED') {
      await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: {
          depositPaid: true,
        },
      });
    }

    logger.info(`Payment webhook processed: ${payment.id} - ${status}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
