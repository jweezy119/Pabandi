import { Router } from 'express';
import { createWithPayment, confirmPayment, checkin, getBookingStatus } from '../controllers/coreBooking.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v1/bookings/create-with-payment — creates reservation + Square checkout
router.post('/create-with-payment', authenticate, createWithPayment);

// GET /api/v1/bookings/confirm-payment — Square redirect URL (no auth required for redirect)
router.get('/confirm-payment', confirmPayment);

// POST /api/v1/bookings/checkin — check-in with QR scan / host verification
router.post('/checkin', checkin);

// GET /api/v1/bookings/status/:bookingRef — poll booking status
router.get('/status/:bookingRef', getBookingStatus);

export default router;
