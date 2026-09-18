import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { UserRole } from '@prisma/client';
import { 
  createUSDCpayment, 
  createBTCPayInvoice, 
  createManualPayment,
  verifyUSDCpayment,
  verifyBTCPayPayment,
  createPayLioPayment,
  verifyPayLioPayment,
} from '../services/payment.service';
import crypto from 'crypto';

// Create a new crypto payment request
export const createPaymentRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount, currency = 'USDC', type = 'usdc', memo, reference, businessId, payeeId } = req.body;
    
    if (!amount || amount <= 0) {
      throw new CustomError('Amount must be greater than 0', 400);
    }

    const paymentRef = reference || `pab_${crypto.randomBytes(8).toString('hex')}`;

    let paymentRequest: any;
    
    switch (type) {
      case 'usdc':
      case 'solana': {
        paymentRequest = await createUSDCpayment({ 
          amount: parseFloat(amount), 
          reference: paymentRef, 
          memo 
        });
        break;
      }
      case 'btcpay':
      case 'bitcoin': {
        paymentRequest = await createBTCPayInvoice({ 
          amount: parseFloat(amount), 
          currency: currency || 'USD', 
          reference: paymentRef 
        });
        break;
      }
      case 'manual': {
        paymentRequest = createManualPayment({ 
          amount: parseFloat(amount), 
          reference: paymentRef,
          method: req.body.method 
        });
        break;
      }
      default:
        throw new CustomError(`Unsupported payment type: ${type}`, 400);
    }

    // Create crypto payment record in database
    const payment = await prisma.cryptoPayment.create({
      data: {
        type: paymentRequest.type,
        amount: parseFloat(amount),
        currency,
        status: 'PENDING',
        reference: paymentRef,
        payerId: req.user?.id || null,
        payeeId: payeeId || null,
        metadata: {
          ...paymentRequest,
          ...(memo ? { memo } : {}),
        },
      },
    });

    logger.info(`Crypto payment created: ${payment.id} via ${type}`);

    res.status(201).json({
      success: true,
      message: 'Payment request created',
      data: {
        payment,
        request: paymentRequest,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get crypto payment by ID
export const getPaymentById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const payment = await prisma.cryptoPayment.findUnique({
      where: { id },
      include: {
        payer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        payee: {
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
      payment.payerId !== req.user?.id &&
      payment.payeeId !== req.user?.id
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

// Verify a crypto payment
export const verifyPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { txSig, invoiceId } = req.body;

    const payment = await prisma.cryptoPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new CustomError('Payment not found', 404);
    }

    let verificationResult: any = { verified: false };

    if (payment.type === 'solana' && txSig) {
      verificationResult = await verifyUSDCpayment({ 
        reference: payment.reference, 
        txSig 
      });
    } else if (payment.type === 'btcpay' && invoiceId) {
      const btcpayResult = await verifyBTCPayPayment(invoiceId);
      verificationResult = { 
        verified: btcpayResult.confirmed, 
        status: btcpayResult.status 
      };
    } else {
      throw new CustomError(
        'Verification requires txSig for USDC or invoiceId for BTCPay',
        400
      );
    }

    if (verificationResult.verified) {
      await prisma.cryptoPayment.update({
        where: { id: payment.id },
        data: { 
          status: 'COMPLETED', 
          txSignature: txSig || invoiceId || null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        verified: verificationResult.verified,
        status: verificationResult.verified ? 'COMPLETED' : payment.status,
        details: verificationResult,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process BTCPay webhook
export const processBTCPayWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { invoiceId, status, metadata } = req.body;
    
    logger.info(`[BTCPay Webhook] Invoice ${invoiceId} status: ${status}`);

    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Missing invoiceId' });
    }

    // Find payment by reference
    const payment = await prisma.cryptoPayment.findFirst({
      where: {
        reference: metadata?.reference || invoiceId,
      },
    });

    if (!payment) {
      logger.warn(`[BTCPay Webhook] No payment found for invoice ${invoiceId}`);
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const newStatus = status === 'Settled' || status === 'Complete' ? 'COMPLETED' : 
                      status === 'Expired' ? 'FAILED' : payment.status;

    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        txSignature: invoiceId,
        metadata: {
          ...((payment.metadata as any) || {}),
          btcpayWebhook: req.body,
        },
      },
    });

    res.json({ success: true, status: newStatus });
  } catch (error: any) {
    logger.error(`[BTCPay Webhook] Error: ${error.message}`);
    next(error);
  }
};

// Create escrow for a crypto payment
export const createEscrow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { paymentId, payerId, payeeId, amount } = req.body;

    if (!paymentId || !payerId || !payeeId || !amount) {
      throw new CustomError('paymentId, payerId, payeeId, and amount are required', 400);
    }

    const payment = await prisma.cryptoPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new CustomError('Payment not found', 404);
    }

    // Only payer or admin can create escrow
    if (payerId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only payer can create escrow', 403);
    }

    const escrow = await prisma.escrow.create({
      data: {
        paymentId,
        amount: parseFloat(amount),
        status: 'PENDING',
        payerId,
        payeeId,
      },
    });

    logger.info(`Escrow created: ${escrow.id} for payment ${paymentId}`);

    res.status(201).json({
      success: true,
      data: escrow,
    });
  } catch (error) {
    next(error);
  }
};

// Release escrow
export const releaseEscrow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const escrow = await prisma.escrow.findUnique({ where: { id } });
    if (!escrow) {
      throw new CustomError('Escrow not found', 404);
    }

    // Only payee can release (or admin)
    if (escrow.payeeId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only payee can release escrow', 403);
    }

    if (escrow.status !== 'PENDING' && escrow.status !== 'HELD') {
      throw new CustomError(`Cannot release from status ${escrow.status}`, 400);
    }

    await prisma.escrow.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releasedBy: req.user!.id,
      },
    });

    // Update associated crypto payment status
    if (escrow.paymentId) {
      await prisma.cryptoPayment.update({
        where: { id: escrow.paymentId },
        data: { status: 'COMPLETED' },
      });
    }

    logger.info(`Escrow released: ${id} by ${req.user!.id}`);

    res.json({ success: true, data: { status: 'RELEASED' } });
  } catch (error) {
    next(error);
  }
};

// Refund escrow
export const refundEscrow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const escrow = await prisma.escrow.findUnique({ where: { id } });
    if (!escrow) {
      throw new CustomError('Escrow not found', 404);
    }

    // Only payer can request refund (or admin)
    if (escrow.payerId !== req.user!.id && req.user!.role !== UserRole.ADMIN) {
      throw new CustomError('Only payer can request refund', 403);
    }

    if (escrow.status === 'RELEASED') {
      throw new CustomError('Cannot refund an already released escrow', 400);
    }

    await prisma.escrow.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundReason: reason,
        releasedAt: new Date(),
      },
    });

    // Update associated crypto payment status
    if (escrow.paymentId) {
      await prisma.cryptoPayment.update({
        where: { id: escrow.paymentId },
        data: { status: 'REFUNDED' },
      });
    }

    logger.info(`Escrow refunded: ${id} (reason: ${reason})`);

    res.json({ success: true, data: { status: 'REFUNDED' } });
  } catch (error) {
    next(error);
  }
};

// Get escrow details
export const getEscrowById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const escrow = await prisma.escrow.findUnique({
      where: { id },
      include: {
        payer: { select: { id: true, email: true, firstName: true, lastName: true } },
        payee: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!escrow) {
      throw new CustomError('Escrow not found', 404);
    }

    // Only involved parties or admin can view
    if (
      escrow.payerId !== req.user!.id &&
      escrow.payeeId !== req.user!.id &&
      req.user!.role !== UserRole.ADMIN
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    res.json({ success: true, data: escrow });
  } catch (error) {
    next(error);
  }
};

// Get crypto payment status
export const getPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const payment = await prisma.cryptoPayment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new CustomError('Payment not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        type: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
        txSignature: payment.txSignature,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PayLio Controllers ──────────────────────────────────────────────────────

export const createPayLio = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { amount, reference, customerEmail } = req.body;
    if (!amount || !reference) {
      return res.status(400).json({ success: false, error: 'amount and reference are required' });
    }
    const result = await createPayLioPayment({
      amount: parseFloat(amount),
      reference,
      customerEmail,
    });
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      data: { id: result.id, url: result.url, type: 'paylio' },
    });
  } catch (error) {
    next(error);
  }
};

export const getPayLioPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const status = await verifyPayLioPayment(id);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

export const processPayLioWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // ── Signature verification ─────────────────────────────────────────────
    const PAYLIO_WEBHOOK_SECRET = process.env.PAYLIO_WEBHOOK_SECRET;
    if (PAYLIO_WEBHOOK_SECRET) {
      const signature = String(req.headers['x-paylio-signature'] || req.headers['x-webhook-signature'] || '');
      if (!signature) {
        logger.warn('[PayLio Webhook] Missing signature header');
        return res.status(401).json({ success: false, error: 'Missing signature' });
      }

      const crypto = await import('crypto');
      const rawBody = JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', PAYLIO_WEBHOOK_SECRET).update(rawBody).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        logger.warn('[PayLio Webhook] Invalid signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }

    const { event, data } = req.body;
    logger.info(`[PayLio Webhook] Event: ${event}`, data);
    
    if (event === 'payment.completed' || event === 'payment.success') {
      const reference = data?.reference || data?.payment_id || data?.id;
      const paylioId = data?.id || data?.payment_id;
      logger.info(`[PayLio] Payment completed: reference=${reference}, id=${paylioId}`);
      
      if (reference) {
        try {
          const { bookingService } = await import('../services/booking.service');
          const result = await bookingService.confirmPaymentAndCreateEscrow(reference);
          if (result.success) {
            logger.info(`[PayLio] Escrow created for ${reference}: ${result.escrowId}`);
          } else {
            logger.warn(`[PayLio] Escrow creation failed for ${reference}: ${result.message}`);
          }
        } catch (escrowErr: any) {
          logger.error(`[PayLio] Error creating escrow for ${reference}: ${escrowErr.message}`);
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
