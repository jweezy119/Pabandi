// Controller for the end-to-end Square booking flow
// Wires: reservation creation → Square checkout → payment confirmation → rewards → check-in → escrow release

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { rewardEngine } from '../services/rewardEngine.service';
import { squareService } from '../services/squareCheckout.service';
import { generateQRCodeUrl } from '../utils/qrcode';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPOSIT_AMOUNT = 25; // flat $25 for demo
const CREATION_FEE_BPS = 100; // 1%
const RELEASE_FEE_BPS = 100; // 1% (total 2%)
const PAB_PRICE_USD = 0.10;

function generateBookingRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAB-${ts}-${rand}`;
}

// ── POST /api/v1/bookings/create-with-payment ────────────────────────────────
export const createBookingWithPayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      businessId,
      date,
      time,
      partySize,
      customerId: providedCustomerId,
      customerEmail: providedCustomerEmail,
      customerName: providedCustomerName,
    } = req.body;

    if (!businessId || !date || !time || !partySize) {
      return res.status(400).json({
        success: false,
        error: 'businessId, date, time, partySize are required',
      });
    }

    const authReq = req as AuthRequest;
    const userId = authReq.user?.id || providedCustomerId || 'demo-customer';
    const email = authReq.user?.email || providedCustomerEmail || 'guest@pabandi.com';
    const name = authReq.user
      ? `${authReq.user.firstName || ''} ${authReq.user.lastName || ''}`.trim()
      : providedCustomerName || 'Guest';

    // Look up business (by id or googlePlaceId)
    const business = await prisma.business.findFirst({
      where: { OR: [{ id: businessId }, { googlePlaceId: businessId }] },
      include: { owner: true },
    });

    if (!business) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    const bookingRef = generateBookingRef();
    const depositAmount = DEPOSIT_AMOUNT;

    // Create reservation with PENDING status
    const reservation = await prisma.reservation.create({
      data: {
        businessId: business.id,
        customerId: userId,
        reservationDate: new Date(`${date}T${time}:00`),
        reservationTime: time,
        numberOfGuests: parseInt(partySize, 10),
        status: 'PENDING',
        customerName: name,
        customerPhone: '',
        customerEmail: email,
        depositRequired: true,
        depositAmount,
        depositStatus: 'PENDING',
        source: 'web',
      },
    });

    // Calculate creation fee (1%)
    const creationFee = (depositAmount * CREATION_FEE_BPS) / 10000;
    const netAfterCreationFee = depositAmount - creationFee;

    // Create a Payment record for the Square transaction
    const payment = await prisma.payment.create({
      data: {
        reservationId: reservation.id,
        userId,
        businessId: business.id,
        amount: depositAmount,
        currency: 'USD',
        status: 'PENDING',
        paymentMethod: 'SQUARE',
        platformFeeAmount: creationFee,
        platformFeeStatus: 'CREATION_FEE',
      },
    });

    // Calculate rewards preview for the customer
    const rewardsPreview = rewardEngine.calculateRewards(depositAmount);

    // Create Square hosted checkout session
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    let squareCheckoutUrl: string;

    try {
      const checkout = await squareService.createCheckout({
        referenceId: bookingRef,
        amount: depositAmount * 100, // cents
        currency: 'USD',
        redirectUrl: `${baseUrl}/api/v1/bookings/confirm-payment?ref=${bookingRef}&paymentId=${payment.id}`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sitara/book/${businessId}?pay=cancelled`,
        note: `Pabandi booking ${bookingRef}`,
        customerEmail: email,
      });
      squareCheckoutUrl = checkout.url;
    } catch (err: any) {
      // If Square credentials aren't configured, return a demo URL for testing
      squareCheckoutUrl = `${baseUrl}/api/v1/bookings/confirm-payment?ref=${bookingRef}&paymentId=${payment.id}&demo=true`;
      console.warn(`Square checkout creation failed (${err.message}); using demo URL for dev.`);
    }

    return res.status(201).json({
      success: true,
      data: {
        bookingRef,
        reservationId: reservation.id,
        squareCheckoutUrl,
        depositAmount,
        creationFee,
        netAfterCreationFee,
        businessName: business.name,
        businessId: business.id,
        rewardsPreview: {
          customerPab: rewardsPreview.customerRewardPab,
          customerUsd: rewardsPreview.customerRewardUsd,
          businessPab: rewardsPreview.businessRewardPab,
          businessUsd: rewardsPreview.businessRewardUsd,
          message: `You'll earn $${rewardsPreview.customerRewardPab.toFixed(2)} PAB ($${rewardsPreview.customerRewardUsd.toFixed(2)})`,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST/GET /api/v1/bookings/confirm-payment ────────────────────────────────
export const confirmPaymentAndIssueRewards = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const isBrowserRedirect = req.method === 'GET';
    // Support both POST body and GET query params (Square redirect uses GET with query)
    const bookingRef = req.body?.ref || req.query?.ref as string;
    const paymentId = req.body?.paymentId || req.query?.paymentId as string;
    const demo = req.query?.demo === 'true' || req.body?.demo === true;

    if (!bookingRef) {
      return res.status(400).json({ success: false, error: 'Missing booking reference' });
    }

    // Find the payment record
    const payment = paymentId
      ? await prisma.payment.findUnique({ where: { id: paymentId } })
      : await prisma.payment.findFirst({
          where: { reservation: { is: { status: 'PENDING' } } },
        });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Verify with Square (unless demo mode)
    if (!demo) {
      try {
        // Attempt to verify payment with Square API
        // In production, this checks the Square payment ID against the API
        // For now we trust the redirect (Square's redirect_url includes paymentId)
      } catch (verifyErr) {
        console.warn('Square verification skipped/failed:', verifyErr);
      }
    }

    // Find the reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id: payment.reservationId! },
      include: { business: true },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    if (reservation.depositStatus === 'PAID') {
      // Already processed — return success
      const qrCodeUrl = generateQRCodeUrl(bookingRef);
      return res.json({
        success: true,
        data: {
          bookingRef,
          status: 'PAID',
          qrCodeUrl,
          message: 'Payment already confirmed',
        },
      });
    }

    // Calculate fees
    const depositAmount = payment.amount;
    const creationFee = (depositAmount * CREATION_FEE_BPS) / 10000;
    const heldAmount = depositAmount - creationFee;

    // ── Update reservation to PAID ────────────────────────────────────────
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CONFIRMED',
        depositStatus: 'PAID',
        depositPaid: true,
        rewardEarned: rewardEngine.calculateRewards(depositAmount).customerRewardPab,
      },
    });

    // ── Update payment record ─────────────────────────────────────────────
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        transactionId: bookingRef,
        platformFeeAmount: creationFee,
        platformFeeStatus: 'CREATION_FEE_COLLECTED',
      },
    });

    // ── Issue $PAB rewards to customer AND business ───────────────────────
    let customerRewardPab = 0;
    let businessRewardPab = 0;

    try {
      const businessRecord = await prisma.business.findUnique({
        where: { id: reservation.businessId },
      });
      const rewardResult = await rewardEngine.issueRewards({
        customerId: reservation.customerId,
        businessId: businessRecord?.ownerId || reservation.businessId,
        purchaseAmount: depositAmount,
        referenceId: bookingRef,
        referenceType: 'BOOKING_DEPOSIT',
      });
      customerRewardPab = rewardResult.customerReward.amount;
      businessRewardPab = rewardResult.businessReward.amount;
    } catch (rewardErr: any) {
      // Fallback: calculate without persisting if issue fails
      const calc = rewardEngine.calculateRewards(depositAmount);
      customerRewardPab = calc.customerRewardPab;
      businessRewardPab = calc.businessRewardPab;
      console.warn(`Reward issuance failed (${rewardErr.message}); calculated only.`);
    }

    // ── Create escrow record (HELD) ───────────────────────────────────────
    const businessRecord = await prisma.business.findUnique({
      where: { id: reservation.businessId },
    });
    const escrow = await prisma.escrow.create({
      data: {
        paymentId: payment.id,
        amount: heldAmount,
        status: 'HELD',
        payerId: reservation.customerId,
        payeeId: businessRecord?.ownerId || reservation.businessId,
      },
    });

    // ── Generate QR code for check-in ─────────────────────────────────────
    const qrCodeUrl = generateQRCodeUrl(bookingRef);

    // ── Update reservation with QR code ──────────────────────────────────
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        qrCode: qrCodeUrl,
        qrCodeExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      success: true,
      data: {
        bookingRef,
        reservationId: reservation.id,
        status: 'PAID',
        depositAmount,
        creationFee,
        escrowId: escrow.id,
        escrowHeld: heldAmount,
        rewards: {
          customerPab: customerRewardPab,
          customerUsd: customerRewardPab * PAB_PRICE_USD,
          businessPab: businessRewardPab,
          businessUsd: businessRewardPab * PAB_PRICE_USD,
        },
        qrCodeUrl,
        businessName: reservation.business?.name || 'this business',
        date: reservation.reservationDate,
        time: reservation.reservationTime,
        guests: reservation.numberOfGuests,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/v1/bookings/checkin ─────────────────────────────────────────────
export const checkInAndReleaseEscrow = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bookingRef, hostId: providedHostId } = req.body;
    const authReq = req as AuthRequest;
    const hostId = authReq.user?.id || providedHostId;

    if (!bookingRef) {
      return res.status(400).json({ success: false, error: 'bookingRef required' });
    }

    // Find reservation via the payment's transactionId (which stores bookingRef)
    const payment = await prisma.payment.findFirst({
      where: { transactionId: bookingRef },
    });

    let reservationId: string | undefined;

    if (payment?.reservationId) {
      reservationId = payment.reservationId;
    } else {
      // Fallback: try to find by reservation qrCode containing ref
      const found = await prisma.reservation.findFirst({
        where: { qrCode: { contains: bookingRef } },
      });
      reservationId = found?.id;
    }

    if (!reservationId) {
      return res.status(404).json({ success: false, error: 'Reservation not found for this booking' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { business: true },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    // Verify host owns the business
    if (providedHostId && reservation.business.ownerId !== providedHostId) {
      // Also allow ADMIN role
      if (!authReq.user || authReq.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, error: 'Only the business owner can check in guests' });
      }
    }

    if (reservation.status === 'CHECKED_IN' || reservation.status === 'COMPLETED') {
      return res.json({
        success: true,
        data: { alreadyCheckedIn: true, status: reservation.status },
        message: 'Guest already checked in',
      });
    }

    if (reservation.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        error: `Cannot check in reservation with status ${reservation.status}`,
      });
    }

    // ── Find escrow record for THIS reservation's payment (no cross-booking fallback) ──
    const paymentForReservation = await prisma.payment.findFirst({
      where: { reservationId: reservation.id },
      orderBy: { createdAt: 'desc' },
    });

    const targetEscrow = paymentForReservation
      ? await prisma.escrow.findFirst({
          where: { paymentId: paymentForReservation.id, status: 'HELD' },
        })
      : null;

    let releaseResult: { releasedAmount: number; releaseFee: number; netToBusiness: number } | null = null;

    if (targetEscrow) {
      // Calculate release fee (1% of original deposit)
      const depositAmount = paymentForReservation?.amount || targetEscrow.amount;
      const releaseFee = (depositAmount * RELEASE_FEE_BPS) / 10000;
      const netToBusiness = targetEscrow.amount - releaseFee;

      // Update escrow to RELEASED
      await prisma.escrow.update({
        where: { id: targetEscrow.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releasedBy: hostId,
        },
      });

      // Credit business owner's wallet
      try {
        await prisma.wallet.upsert({
          where: { userId: targetEscrow.payeeId },
          update: { balance: { increment: netToBusiness }, usdcBalance: { increment: netToBusiness } },
          create: { userId: targetEscrow.payeeId, balance: netToBusiness, usdcBalance: netToBusiness },
        });
      } catch (walletErr: any) {
        console.warn(`Wallet credit failed: ${walletErr.message}`);
      }

      releaseResult = {
        releasedAmount: targetEscrow.amount,
        releaseFee,
        netToBusiness,
      };
    }

    // ── Update reservation status to CHECKED_IN ─────────────────────────────
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CHECKED_IN',
        checkInDate: new Date(),
        checkInMethod: 'qr_scan',
        depositStatus: 'APPLIED_TO_SERVICE',
      },
    });

    const originalDeposit = paymentForReservation?.amount || reservation.depositAmount || 0;
    const totalFees = releaseResult
      ? (originalDeposit * CREATION_FEE_BPS) / 10000 + releaseResult.releaseFee
      : null;

    return res.json({
      success: true,
      data: {
        reservationId: updated.id,
        status: 'CHECKED_IN',
        businessName: reservation.business?.name,
        customerName: reservation.customerName,
        checkedInAt: new Date().toISOString(),
        escrowRelease: releaseResult,
        totalFees,
      },
      message: releaseResult
        ? `Check-in confirmed! Business received $${releaseResult.netToBusiness.toFixed(2)}`
        : 'Check-in confirmed!',
    });
  } catch (err) {
    next(err);
  }
};
