import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createBooking,
  confirmBookingPayment,
  getBookingStatus,
  releaseBookingEscrow,
} from '../controllers/booking.controller';

const router = Router();

// POST /api/v1/booking/create — create booking + deposit payment
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createBooking(req as any, res, next);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/booking/confirm — confirm payment + create escrow
router.post('/confirm', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await confirmBookingPayment(req as any, res, next);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/booking/:reference/status — poll booking status
router.get('/:reference/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await getBookingStatus(req as any, res, next);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/booking/escrow/release — release escrow to business
router.post('/escrow/release', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await releaseBookingEscrow(req as any, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;
