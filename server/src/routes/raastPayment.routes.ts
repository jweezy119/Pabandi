import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { aiPaymentVerifierService } from '../services/ai.payment.verifier.service';
import { releaseEscrowToBusiness } from '../services/booking.service';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * POST /api/v1/payments/raast/verify
 * Upload a Raast payment screenshot for AI verification.
 * Body: multipart/form-data with 'screenshot' file, 'reference', 'amount'
 */
router.post('/verify', authenticate, upload.single('screenshot'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reference, amount } = req.body;
    if (!reference || !amount) {
      return res.status(400).json({ success: false, error: 'reference and amount required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'screenshot file required' });
    }

    // Find the booking's crypto payment
    const payment = await prisma.cryptoPayment.findFirst({
      where: { reference, type: 'manual', payerId: req.user!.id },
    });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Get the business's Raast ID from metadata
    const meta = payment.metadata as any;
    const business = await prisma.business.findUnique({ where: { id: meta?.businessId } });
    const expectedRaastId = business?.raastId || '';
    const expectedAmount = Number(amount);

    // Run AI verification
    const imageBase64 = req.file.buffer.toString('base64');
    const verification = await aiPaymentVerifierService.verify(imageBase64, expectedAmount, expectedRaastId);

    // Store screenshot URL in metadata
    const screenshotUrl = `data:${req.file.mimetype};base64,${imageBase64}`;
    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...meta,
          screenshotUrl,
          verificationResult: verification,
          verifiedAt: new Date().toISOString(),
        },
      },
    });

    logger.info(`[RaastVerify] ${reference}: valid=${verification.isValid}, confidence=${verification.confidence}`);

    res.json({
      success: true,
      data: {
        isValid: verification.isValid,
        confidence: verification.confidence,
        fields: verification.fields,
        message: verification.isValid
          ? 'Screenshot verified. Awaiting venue confirmation.'
          : 'Could not auto-verify. Venue will review manually.',
      },
    });
  } catch (error: any) {
    logger.error(`[RaastVerify] error: ${error.message}`);
    next(error);
  }
});

/**
 * GET /api/v1/payments/raast/pending
 * List pending Raast payments for a business (venue dashboard).
 */
router.get('/pending', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Find business owned by this user
    const business = await prisma.business.findFirst({ where: { ownerId: req.user!.id } });
    if (!business) {
      return res.status(404).json({ success: false, error: 'No business found' });
    }

    // Find pending manual payments for this business
    const payments = await prisma.cryptoPayment.findMany({
      where: {
        type: 'manual',
        status: 'PENDING',
        metadata: { path: ['businessId'], equals: business.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with reservation + customer details
    const enriched = await Promise.all(
      payments.map(async (p) => {
        const meta = p.metadata as any;
        const reservation = meta?.reservationId
          ? await prisma.reservation.findUnique({ where: { id: meta.reservationId } })
          : null;
        const customer = p.payerId
          ? await prisma.user.findUnique({ where: { id: p.payerId }, select: { firstName: true, lastName: true, email: true, phone: true } })
          : null;
        return {
          id: p.id,
          reference: p.reference,
          amount: p.amount,
          status: p.status,
          createdAt: p.createdAt,
          screenshotUrl: meta?.screenshotUrl || null,
          verificationResult: meta?.verificationResult || null,
          reservation: reservation
            ? { date: reservation.reservationDate, time: reservation.reservationTime, guests: reservation.numberOfGuests, name: reservation.customerName }
            : null,
          customer: customer ? { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone } : null,
        };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    logger.error(`[RaastPending] error: ${error.message}`);
    next(error);
  }
});

/**
 * POST /api/v1/payments/raast/:reference/confirm
 * Venue confirms receipt of Raast payment → releases escrow.
 */
router.post('/:reference/confirm', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.params;

    // Find the payment
    const payment = await prisma.cryptoPayment.findFirst({
      where: { reference, type: 'manual', status: 'PENDING' },
    });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found or already processed' });
    }

    const meta = payment.metadata as any;

    // Verify the business owner is confirming
    const business = await prisma.business.findUnique({ where: { id: meta?.businessId } });
    if (!business || business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Update payment status
    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    // Update reservation
    if (meta?.reservationId) {
      await prisma.reservation.update({
        where: { id: meta.reservationId },
        data: { depositStatus: 'PAID', status: 'CONFIRMED', depositPaid: true },
      });
    }

    // Create escrow
    const creationFee = (payment.amount * 100) / 10000; // 1%
    const heldAmount = payment.amount - creationFee;
    const escrow = await prisma.escrow.create({
      data: {
        paymentId: payment.id,
        amount: heldAmount,
        status: 'HELD',
        payerId: payment.payerId!,
        payeeId: payment.payeeId!,
      },
    });

    // Auto-release escrow immediately (since venue confirmed)
    const releaseResult = await releaseEscrowToBusiness(escrow.id, req.user!.id);

    logger.info(`[RaastConfirm] ${reference}: confirmed by ${req.user!.id}, escrow released`);

    res.json({
      success: true,
      message: 'Payment confirmed and escrow released',
      data: {
        escrowId: escrow.id,
        releasedAmount: releaseResult.releasedAmount,
        netToBusiness: releaseResult.netToBusiness,
      },
    });
  } catch (error: any) {
    logger.error(`[RaastConfirm] error: ${error.message}`);
    next(error);
  }
});

/**
 * POST /api/v1/payments/raast/:reference/reject
 * Venue rejects a Raast payment.
 */
router.post('/:reference/reject', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.params;
    const { reason } = req.body;

    const payment = await prisma.cryptoPayment.findFirst({
      where: { reference, type: 'manual', status: 'PENDING' },
    });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found or already processed' });
    }

    const meta = payment.metadata as any;
    const business = await prisma.business.findUnique({ where: { id: meta?.businessId } });
    if (!business || business.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Update payment status
    await prisma.cryptoPayment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: { ...meta, rejectedAt: new Date().toISOString(), rejectedBy: req.user!.id, rejectReason: reason },
      },
    });

    // Update reservation
    if (meta?.reservationId) {
      await prisma.reservation.update({
        where: { id: meta.reservationId },
        data: { depositStatus: 'NOT_REQUIRED', status: 'CANCELLED' },
      });
    }

    logger.info(`[RaastReject] ${reference}: rejected by ${req.user!.id}, reason: ${reason || 'none'}`);

    res.json({ success: true, message: 'Payment rejected' });
  } catch (error: any) {
    logger.error(`[RaastReject] error: ${error.message}`);
    next(error);
  }
});

export default router;
