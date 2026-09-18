import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import {
  createFiatPayment,
  getFiatPaymentStatus,
  confirmFiatPayment,
  rejectFiatPayment,
  cancelFiatPayment,
  markFiatPaymentSent,
  listPendingFiatPayments,
  listUserFiatPayments,
  getAvailableFiatMethods,
  calculateCreationFee,
  FiatMethod,
} from '../services/fiatPayment.service';

// Create a new fiat payment request
export const createFiatPaymentRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      method,
      amount,
      payerEmail,
      payeeId,
      businessId,
      payeeConfig,
      currency = 'USD',
    } = req.body;

    if (!method || !amount || !payeeId || !payeeConfig) {
      throw new CustomError('method, amount, payeeId, and payeeConfig are required', 400);
    }

    // Validate method
    const validMethods = ['PAYPAL', 'VENMO', 'CASH_APP', 'ZELLE', 'ACH', 'CARD', 'CASH', 'CHECK'];
    if (!validMethods.includes(method)) {
      throw new CustomError(`Invalid method. Must be one of: ${validMethods.join(', ')}`, 400);
    }

    if (typeof amount !== 'number' || amount <= 0) {
      throw new CustomError('Amount must be a positive number', 400);
    }

    const creationFee = calculateCreationFee(amount);

    const result = await createFiatPayment({
      method: method as FiatMethod,
      amount,
      payerId: req.user?.id,
      payerEmail,
      payeeId,
      businessId,
      payeeConfig,
      currency,
    });

    logger.info(`[FiatPayment] Created ${method} payment: ${result.reference} for user ${req.user?.id || 'anonymous'}`);

    res.status(201).json({
      success: true,
      message: 'Fiat payment request created',
      data: {
        ...result,
        creationFee,
        netAmount: amount - creationFee,
        warning: 'This payment method requires manual confirmation by the business.',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get fiat payment status
export const getFiatPaymentStatusController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const payment = await getFiatPaymentStatus(reference);

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// Business confirms fiat payment receipt
export const confirmFiatPaymentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const userId = req.user!.id;

    // Verify user is the payee or admin
    const payment = await prisma.fiatPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new CustomError('Fiat payment not found', 404);
    }

    if (payment.payeeId !== userId && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only the receiving business can confirm payment', 403);
    }

    const result = await confirmFiatPayment(reference, userId);

    if (!result.success) {
      throw new CustomError(result.error || 'Failed to confirm payment', 400);
    }

    res.json({
      success: true,
      message: 'Payment confirmed and escrow released',
      data: {
        reference,
        status: 'CONFIRMED',
        escrowId: result.escrowId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Business rejects fiat payment
export const rejectFiatPaymentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    const payment = await prisma.fiatPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new CustomError('Fiat payment not found', 404);
    }

    if (payment.payeeId !== userId && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only the receiving business can reject payment', 403);
    }

    const result = await rejectFiatPayment(reference, userId, reason);

    if (!result.success) {
      throw new CustomError(result.error || 'Failed to reject payment', 400);
    }

    res.json({
      success: true,
      message: 'Payment rejected and escrow refunded',
      data: {
        reference,
        status: 'REJECTED',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel fiat payment
export const cancelFiatPaymentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const userId = req.user!.id;

    const payment = await prisma.fiatPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new CustomError('Fiat payment not found', 404);
    }

    if (payment.payerId !== userId && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only the payer can cancel', 403);
    }

    const result = await cancelFiatPayment(reference, userId);

    if (!result.success) {
      throw new CustomError(result.error || 'Failed to cancel payment', 400);
    }

    res.json({
      success: true,
      message: 'Payment cancelled and escrow refunded',
      data: {
        reference,
        status: 'CANCELLED',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Payer marks payment as sent
export const markFiatPaymentSentController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const userId = req.user!.id;

    const payment = await prisma.fiatPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new CustomError('Fiat payment not found', 404);
    }

    if (payment.payerId !== userId) {
      throw new CustomError('Only the payer can mark as sent', 403);
    }

    const result = await markFiatPaymentSent(reference, userId);

    if (!result.success) {
      throw new CustomError(result.error || 'Failed to mark as sent', 400);
    }

    res.json({
      success: true,
      message: 'Payment marked as sent. Awaiting business confirmation.',
      data: {
        reference,
        status: 'SENT',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get available fiat payment methods
export const getFiatMethods = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const methods = getAvailableFiatMethods();
    res.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    next(error);
  }
};

// List pending payments for a business
export const listPendingFiatPaymentsController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { businessId } = req.query;
    const userId = req.user!.id;

    // Verify ownership
    if (businessId) {
      const business = await prisma.business.findUnique({
        where: { id: businessId as string },
      });

      if (!business || business.ownerId !== userId) {
        if (req.user!.role !== UserRole.ADMIN) {
          throw new CustomError('Unauthorized', 403);
        }
      }
    }

    const targetBusinessId = (businessId as string) || null;

    if (!targetBusinessId) {
      // Return all user's payments
      const payments = await listUserFiatPayments(userId);
      return res.json({
        success: true,
        data: payments,
      });
    }

    const payments = await listPendingFiatPayments(targetBusinessId);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};
