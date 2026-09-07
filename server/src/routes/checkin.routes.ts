import { Router, Request, Response, NextFunction } from 'express';
import { checkInService } from '../services/checkin.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Generate check-in QR code for a reservation
router.post('/:reservationId/qr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const result = await checkInService.generateCheckInToken(reservationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Verify check-in (can be called by staff scanning QR or customer entering code manually)
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, reservationId, lat, lng, method } = req.body;
    const result = await checkInService.verifyCheckIn({
      code,
      reservationId,
      lat,
      lng,
      method: method || 'manual',
      verifiedBy: (req as any)?.user?.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Check out
router.post('/:reservationId/checkout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const result = await checkInService.checkOut(reservationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get check-in history
router.get('/:reservationId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const result = await checkInService.getCheckInHistory(reservationId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get active check-ins for a business
router.get('/business/:businessId/active', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const result = await checkInService.getActiveCheckIns(businessId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
