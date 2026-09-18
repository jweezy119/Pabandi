// Pabandi Booking Flow Service
// Orchestrates the end-to-end booking → payment → escrow → check-in → release flow

import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { createPayLioPayment, verifyPayLioPayment } from './payment.service';

const CREATION_FEE_BPS = 100; // 1% = 100 basis points
const RELEASE_FEE_BPS = 100; // 1% = 100 basis points
const TOTAL_FEE_BPS = 200; // 2% total

export interface CreateBookingInput {
  businessId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  reservationDate: string;
  reservationTime: string;
  numberOfGuests: number;
  depositAmount: number;
  specialRequests?: string;
  paymentMethod?: 'paylio' | 'raast';
}

export interface BookingResult {
  success: boolean;
  reservationId?: string;
  bookingReference: string;
  paymentUrl?: string;
  paymentId?: string;
  depositAmount: number;
  paymentMethod?: string;
  raastId?: string;
  message: string;
}

/**
 * Create a reservation + deposit payment in one call.
 * Returns the reservation id, a unique booking reference, and a PayLio checkout URL.
 */
export async function createBookingWithDeposit(input: CreateBookingInput): Promise<BookingResult> {
  const {
    businessId, customerId, customerName, customerEmail, customerPhone,
    reservationDate, reservationTime, numberOfGuests, depositAmount, specialRequests,
    paymentMethod = 'paylio',
  } = input;

  const bookingReference = `PAB-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  // Verify business exists and is active
  const business = await prisma.business.findFirst({
    where: { OR: [{ id: businessId }, { googlePlaceId: businessId }] },
    include: { settings: true, owner: true },
  });

  if (!business) {
    return { success: false, bookingReference, depositAmount: 0, message: 'Business not found' };
  }
  if (!business.isActive) {
    return { success: false, bookingReference, depositAmount: 0, message: 'Business is inactive' };
  }

  // Find the business owner to use as payee
  const payeeId = business.ownerId;
  if (!payeeId) {
    return { success: false, bookingReference, depositAmount: 0, message: 'Business has no owner' };
  }

  // Calculate fees
  const creationFee = (depositAmount * CREATION_FEE_BPS) / 10000;
  const netDeposit = depositAmount - creationFee;

  // Create reservation
  const reservation = await prisma.reservation.create({
    data: {
      businessId: business.id,
      customerId,
      reservationDate: new Date(`${reservationDate}T${reservationTime}:00`),
      reservationTime,
      numberOfGuests,
      status: 'PENDING',
      customerName,
      customerPhone: customerPhone || '',
      customerEmail: customerEmail,
      specialRequests,
      depositRequired: true,
      depositAmount,
      depositStatus: 'PENDING',
      source: 'web',
    },
  });

  // Create crypto payment record
  const cryptoPayment = await prisma.cryptoPayment.create({
    data: {
      type: paymentMethod === 'raast' ? 'manual' : 'paylio',
      amount: depositAmount,
      currency: 'USD',
      status: paymentMethod === 'raast' ? 'PENDING' : 'PENDING',
      reference: bookingReference,
      payerId: customerId,
      payeeId,
      metadata: {
        reservationId: reservation.id,
        businessId: business.id,
        creationFee,
        netDeposit,
        depositAmount,
        paymentMethod,
      },
    },
  });

  // Create PayLio checkout session (skip for Raast)
  let paymentUrl: string | undefined;
  let raastId: string | undefined;
  if (paymentMethod === 'raast') {
    raastId = business.raastId || undefined;
  } else {
    try {
      const paylioResult = await createPayLioPayment({
        amount: depositAmount,
        reference: bookingReference,
        customerEmail,
      });
      if (paylioResult.url) {
        paymentUrl = paylioResult.url;
      }
    } catch (err: any) {
      logger.warn(`[BookingService] PayLio creation failed for ${bookingReference}: ${err.message}`);
    }
  }

  logger.info(
    `[BookingService] Booking ${bookingReference} created: reservation=${reservation.id}, payment=${cryptoPayment.id}, amount=$${depositAmount}`
  );

  return {
    success: true,
    reservationId: reservation.id,
    bookingReference,
    paymentUrl,
    paymentId: cryptoPayment.id,
    depositAmount,
    paymentMethod,
    raastId,
    message: paymentUrl
      ? 'Reservation created. Redirecting to payment...'
      : paymentMethod === 'raast'
        ? 'Reservation created. Complete Raast payment using the instructions below.'
        : 'Reservation created. Complete payment to confirm booking.',
  };
}

/**
 * Confirm payment when PayLio sends webhook or frontend polls.
 * Updates reservation, creates escrow record (HELD).
 */
export async function confirmPaymentAndCreateEscrow(bookingReference: string): Promise<{
  success: boolean;
  escrowId?: string;
  message: string;
}> {
  const payment = await prisma.cryptoPayment.findFirst({
    where: { reference: bookingReference },
  });

  if (!payment) {
    return { success: false, message: 'Payment not found' };
  }

  const reservationId = (payment.metadata as any)?.reservationId;
  if (!reservationId) {
    return { success: false, message: 'No reservation linked to payment' };
  }

  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  // Update payment status
  await prisma.cryptoPayment.update({
    where: { id: payment.id },
    data: { status: 'COMPLETED' },
  });

  // Update reservation
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      depositStatus: 'PAID',
      status: 'CONFIRMED',
      depositPaid: true,
    },
  });

  // Calculate creation fee
  const depositAmount = payment.amount;
  const creationFee = (depositAmount * CREATION_FEE_BPS) / 10000;
  const heldAmount = depositAmount - creationFee;

  // Create escrow record (HELD)
  const escrow = await prisma.escrow.create({
    data: {
      paymentId: payment.id,
      amount: heldAmount,
      status: 'HELD',
      payerId: payment.payerId!,
      payeeId: payment.payeeId!,
    },
  });

  logger.info(
    `[BookingService] Escrow created for ${bookingReference}: escrow=${escrow.id}, held=$${heldAmount} (fee: $${creationFee})`
  );

  return {
    success: true,
    escrowId: escrow.id,
    message: 'Payment confirmed. Deposit held in escrow.',
  };
}

/**
 * Poll PayLio for payment status. Returns true if payment is confirmed.
 */
export async function pollPaymentStatus(paylioPaymentId: string): Promise<{
  confirmed: boolean;
  status: string;
  amount?: number;
}> {
  const result = await verifyPayLioPayment(paylioPaymentId);
  return {
    confirmed: result.confirmed,
    status: result.status,
    amount: result.amount,
  };
}

/**
 * Release escrow to business after check-in.
 * Deducts 1% release fee, sends remaining to business wallet.
 */
export async function releaseEscrowToBusiness(escrowId: string, releasedBy: string): Promise<{
  success: boolean;
  releasedAmount?: number;
  releaseFee?: number;
  netToBusiness?: number;
  message: string;
}> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
  });

  if (!escrow) {
    return { success: false, message: 'Escrow not found' };
  }
  if (escrow.status !== 'HELD') {
    return { success: false, message: `Cannot release from status ${escrow.status}` };
  }

  // Get the crypto payment for fee calculation
  const cryptoPayment = escrow.paymentId
    ? await prisma.cryptoPayment.findUnique({ where: { id: escrow.paymentId } })
    : null;

  const heldAmount = escrow.amount;
  const releaseFee = (heldAmount * RELEASE_FEE_BPS) / 10000;
  const netToBusiness = heldAmount - releaseFee;
  const originalAmount = cryptoPayment?.amount || heldAmount;
  const totalFees = originalAmount * (TOTAL_FEE_BPS / 10000);

  // Update escrow
  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releasedBy,
    },
  });

  // Update reservation if linked
  if (cryptoPayment) {
    const meta = cryptoPayment.metadata as any;
    if (meta?.reservationId) {
      await prisma.reservation.update({
        where: { id: meta.reservationId },
        data: {
          status: 'COMPLETED',
          depositStatus: 'APPLIED_TO_SERVICE',
        },
      });
    }
  }

  // Credit business owner wallet
  try {
    await prisma.wallet.upsert({
      where: { userId: escrow.payeeId },
      update: { balance: { increment: netToBusiness }, usdcBalance: { increment: netToBusiness } },
      create: { userId: escrow.payeeId, balance: netToBusiness, usdcBalance: netToBusiness },
    });
  } catch (walletErr: any) {
    logger.warn(`[BookingService] Wallet credit failed for ${escrow.payeeId}: ${walletErr.message}`);
  }

  logger.info(
    `[BookingService] Escrow ${escrowId} released: gross=$${heldAmount}, releaseFee=$${releaseFee}, netToBusiness=$${netToBusiness}, totalFees=$${totalFees}`
  );

  return {
    success: true,
    releasedAmount: heldAmount,
    releaseFee,
    netToBusiness,
    message: `Released $${netToBusiness} to business (total fees: $${totalFees.toFixed(2)})`,
  };
}

/**
 * Get booking details by reservation ID or booking reference.
 */
export async function getBookingDetails(reservationId?: string, bookingReference?: string) {
  if (bookingReference) {
    const payment = await prisma.cryptoPayment.findFirst({
      where: { reference: bookingReference },
    });
    if (!payment) return null;
    const meta = payment.metadata as any;
    return prisma.reservation.findUnique({
      where: { id: meta.reservationId },
      include: { business: true },
    });
  }
  if (reservationId) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { business: true, payments: true },
    });
  }
  return null;
}

export const bookingService = {
  createBookingWithDeposit,
  confirmPaymentAndCreateEscrow,
  pollPaymentStatus,
  releaseEscrowToBusiness,
  getBookingDetails,
};
