import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';

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

    // TODO: Integrate with payment gateway (Stripe, JazzCash, EasyPaisa)
    // For now, simulate payment processing
    logger.info(`Payment created: ${payment.id}`);

    res.status(201).json({
      success: true,
      message: 'Payment initiated',
      data: {
        payment: {
          ...payment,
          // In production, return payment gateway redirect URL or payment link
          paymentUrl: `/payment/process/${payment.id}`,
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
    // TODO: Verify webhook signature from payment gateway
    const { paymentId, status, transactionId } = req.body;

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: status.toUpperCase(),
        transactionId,
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

    logger.info(`Payment webhook processed: ${paymentId} - ${status}`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
