"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseBookingEscrow = exports.getBookingStatus = exports.confirmBookingPayment = exports.createBooking = void 0;
const logger_1 = require("../utils/logger");
const booking_service_1 = require("../services/booking.service");
/**
 * POST /api/v1/booking/create
 * Create a reservation + deposit payment (PayLio checkout URL returned)
 */
const createBooking = async (req, res, next) => {
    try {
        const { businessId, reservationDate, reservationTime, numberOfGuests, customerName, customerEmail, customerPhone, depositAmount, specialRequests, paymentMethod, intentMandate, cartMandate, paymentMandate, } = req.body;
        if (!businessId || !reservationDate || !reservationTime || !numberOfGuests) {
            return res.status(400).json({
                success: false,
                error: 'businessId, reservationDate, reservationTime, numberOfGuests required',
            });
        }
        if (!req.user?.id) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const bookingData = {
            businessId,
            customerId: req.user.id,
            customerName: customerName || req.body.fullName || 'Guest',
            customerEmail: customerEmail || req.user.email,
            customerPhone: customerPhone || req.body.phone,
            reservationDate,
            reservationTime,
            numberOfGuests: parseInt(numberOfGuests, 10),
            depositAmount: parseFloat(depositAmount) || 25,
            specialRequests,
            paymentMethod: paymentMethod || 'paylio',
            intentMandate,
            cartMandate,
            paymentMandate,
        };
        if (intentMandate && cartMandate && paymentMandate) {
            logger_1.logger.info(`[AP2] Mandates attached to booking for user ${req.user.id}`);
        }
        const result = await (0, booking_service_1.createBookingWithDeposit)(bookingData);
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
    }
    catch (error) {
        logger_1.logger.error(`[BookingController] createBooking error: ${error.message}`);
        next(error);
    }
};
exports.createBooking = createBooking;
/**
 * POST /api/v1/booking/confirm
 * Confirm payment for a booking (polling endpoint)
 */
const confirmBookingPayment = async (req, res, next) => {
    try {
        const { bookingReference, paylioPaymentId } = req.body;
        if (!bookingReference) {
            return res.status(400).json({ success: false, error: 'bookingReference required' });
        }
        const result = await (0, booking_service_1.confirmPaymentAndCreateEscrow)(bookingReference);
        res.json({
            success: result.success,
            message: result.message,
            data: { escrowId: result.escrowId },
        });
    }
    catch (error) {
        logger_1.logger.error(`[BookingController] confirmBookingPayment error: ${error.message}`);
        next(error);
    }
};
exports.confirmBookingPayment = confirmBookingPayment;
/**
 * GET /api/v1/booking/:reference/status
 * Get booking status (for polling)
 */
const getBookingStatus = async (req, res, next) => {
    try {
        const { reference } = req.params;
        const booking = await (0, booking_service_1.getBookingDetails)(undefined, reference);
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
    }
    catch (error) {
        logger_1.logger.error(`[BookingController] getBookingStatus error: ${error.message}`);
        next(error);
    }
};
exports.getBookingStatus = getBookingStatus;
/**
 * POST /api/v1/booking/escrow/release
 * Release escrow to business (after check-in)
 */
const releaseBookingEscrow = async (req, res, next) => {
    try {
        const { escrowId } = req.body;
        if (!escrowId) {
            return res.status(400).json({ success: false, error: 'escrowId required' });
        }
        const result = await (0, booking_service_1.releaseEscrowToBusiness)(escrowId, req.user.id);
        res.json({
            success: result.success,
            message: result.message,
            data: {
                releasedAmount: result.releasedAmount,
                releaseFee: result.releaseFee,
                netToBusiness: result.netToBusiness,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[BookingController] releaseBookingEscrow error: ${error.message}`);
        next(error);
    }
};
exports.releaseBookingEscrow = releaseBookingEscrow;
//# sourceMappingURL=booking.controller.js.map