import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import {
  createBookingWithDeposit,
  confirmPaymentAndCreateEscrow,
  releaseEscrowToBusiness,
  getBookingDetails,
} from '../services/booking.service';

/**
 * POST /api/v1/booking/create
 * Create a reservation + deposit payment (PayLio checkout URL returned)
 */
export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      businessId,
      reservationDate,
      reservationTime,
      numberOfGuests,
      customerName,
      customerEmail,
      customerPhone,
      depositAmount,
      specialRequests,
      paymentMethod,
    } = req.body;

    if (!businessId || !reservationDate || !reservationTime || !numberOfGuests) {
      return res.status(400).json({
        success: false,
        error: 'businessId, reservationDate, reservationTime, numberOfGuests required',
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await createBookingWithDeposit({
      businessId,
      customerId: req.user!.id,
      customerName: customerName || req.body.fullName || 'Guest',
      customerEmail: customerEmail || req.user!.email,
      customerPhone: customerPhone || req.body.phone,
      reservationDate,
      reservationTime,
      numberOfGuests: parseInt(numberOfGuests, 10),
      depositAmount: parseFloat(depositAmount) || 25,
      specialRequests,
      paymentMethod: paymentMethod || 'paylio',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        data: { bookingReference: result.bookingReference },
      });
    }

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        reservationId: result.reservationId,
        bookingReference: result.bookingReference,
        depositAmount: result.depositAmount,
        paymentUrl: result.paymentUrl,
        paymentId: result.paymentId,
        paymentMethod: result.paymentMethod,
        raastId: result.raastId,
      },
    });
  } catch (error: any) {
    logger.error(`[BookingController] createBooking error: ${error.message}`);
    next(error);
  }
};

/**
 * POST /api/v1/booking/confirm
 * Confirm payment for a booking (polling endpoint)
 */
export const confirmBookingPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingReference, paylioPaymentId } = req.body;

    if (!bookingReference) {
      return res.status(400).json({ success: false, error: 'bookingReference required' });
    }

    const result = await confirmPaymentAndCreateEscrow(bookingReference);

    res.json({
      success: result.success,
      message: result.message,
      data: { escrowId: result.escrowId },
    });
  } catch (error: any) {
    logger.error(`[BookingController] confirmBookingPayment error: ${error.message}`);
    next(error);
  }
};

/**
 * GET /api/v1/booking/:reference/status
 * Get booking status (for polling)
 */
export const getBookingStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reference } = req.params;
    const booking = await getBookingDetails(undefined, reference);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({
      success: true,
      data: {
        status: booking.status,
        depositStatus: booking.depositStatus,
        reservationId: booking.id,
        businessName: booking.business?.name,
      },
    });
  } catch (error: any) {
    logger.error(`[BookingController] getBookingStatus error: ${error.message}`);
    next(error);
  }
};

/**
 * POST /api/v1/booking/escrow/release
 * Release escrow to business (after check-in)
 */
export const releaseBookingEscrow = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { escrowId } = req.body;

    if (!escrowId) {
      return res.status(400).json({ success: false, error: 'escrowId required' });
    }

    const result = await releaseEscrowToBusiness(escrowId, req.user!.id);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        releasedAmount: result.releasedAmount,
        releaseFee: result.releaseFee,
        netToBusiness: result.netToBusiness,
      },
    });
  } catch (error: any) {
    logger.error(`[BookingController] releaseBookingEscrow error: ${error.message}`);
    next(error);
  }
};
