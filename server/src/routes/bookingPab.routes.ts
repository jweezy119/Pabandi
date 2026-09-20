import { Router, Request, Response } from 'express';
import { bookingPabService } from '../services/bookingPab.service';
import { authenticate } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/booking-pab/create
 * Create a booking with PAB deposit
 * Body: { bookingId: string, bookingValue: number, businessId?: string }
 */
router.post('/create', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { bookingId, bookingValue, businessId } = req.body;

  if (!bookingId || !bookingValue) {
    return res.status(400).json({ success: false, error: 'bookingId and bookingValue are required' });
  }

  if (typeof bookingValue !== 'number' || bookingValue <= 0) {
    return res.status(400).json({ success: false, error: 'bookingValue must be a positive number' });
  }

  try {
    const result = await bookingPabService.createBookingWithPab({
      bookingId,
      userId: req.user!.id,
      bookingValue,
      businessId,
    });
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    logger.error('[BookingPabRoutes] /create error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/booking-pab/checkin
 * Check in to a booking - returns deposit + reward
 * Body: { bookingId: string }
 */
router.post('/checkin', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'bookingId is required' });
  }

  try {
    const result = await bookingPabService.checkinBooking(bookingId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('[BookingPabRoutes] /checkin error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/booking-pab/noshow
 * Mark booking as no-show (slash deposit)
 * Body: { bookingId: string }
 */
router.post('/noshow', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'bookingId is required' });
  }

  try {
    const result = await bookingPabService.handleNoShow(bookingId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('[BookingPabRoutes] /noshow error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/booking-pab/cancel
 * Cancel booking before 24h (full refund)
 * Body: { bookingId: string }
 */
router.post('/cancel', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'bookingId is required' });
  }

  try {
    const result = await bookingPabService.cancelBooking(bookingId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('[BookingPabRoutes] /cancel error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
