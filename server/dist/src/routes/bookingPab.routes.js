"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingPab_service_1 = require("../services/bookingPab.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/booking-pab/create
 * Create a booking with PAB deposit
 * Body: { bookingId: string, bookingValue: number, businessId?: string }
 */
router.post('/create', auth_middleware_1.authenticate, async (req, res) => {
    const { bookingId, bookingValue, businessId } = req.body;
    if (!bookingId || !bookingValue) {
        return res.status(400).json({ success: false, error: 'bookingId and bookingValue are required' });
    }
    if (typeof bookingValue !== 'number' || bookingValue <= 0) {
        return res.status(400).json({ success: false, error: 'bookingValue must be a positive number' });
    }
    try {
        const result = await bookingPab_service_1.bookingPabService.createBookingWithPab({
            bookingId,
            userId: req.user.id,
            bookingValue,
            businessId,
        });
        return res.status(result.success ? 201 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[BookingPabRoutes] /create error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/booking-pab/checkin
 * Check in to a booking - returns deposit + reward
 * Body: { bookingId: string }
 */
router.post('/checkin', auth_middleware_1.authenticate, async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
        return res.status(400).json({ success: false, error: 'bookingId is required' });
    }
    try {
        const result = await bookingPab_service_1.bookingPabService.checkinBooking(bookingId);
        return res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[BookingPabRoutes] /checkin error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/booking-pab/noshow
 * Mark booking as no-show (slash deposit)
 * Body: { bookingId: string }
 */
router.post('/noshow', auth_middleware_1.authenticate, async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
        return res.status(400).json({ success: false, error: 'bookingId is required' });
    }
    try {
        const result = await bookingPab_service_1.bookingPabService.handleNoShow(bookingId);
        return res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[BookingPabRoutes] /noshow error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/booking-pab/cancel
 * Cancel booking before 24h (full refund)
 * Body: { bookingId: string }
 */
router.post('/cancel', auth_middleware_1.authenticate, async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
        return res.status(400).json({ success: false, error: 'bookingId is required' });
    }
    try {
        const result = await bookingPab_service_1.bookingPabService.cancelBooking(bookingId);
        return res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[BookingPabRoutes] /cancel error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=bookingPab.routes.js.map