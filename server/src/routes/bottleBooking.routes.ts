import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ── POST /api/v1/bookings/bottle (auth required) ──────────────────────────
router.post('/bottle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { bottleBookingService } = await import('../services/bottleBooking.service');

    // Apply auth middleware inline
    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const booking = await bottleBookingService.createBooking({
      userId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to create booking' });
  }
});

// ── GET /api/v1/bookings/my-bookings (auth required) ──────────────────────
router.get('/my-bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { bottleBookingService } = await import('../services/bottleBooking.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const bookings = await bottleBookingService.getUserBookings(userId);
    res.json({ success: true, data: bookings });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load bookings' });
  }
});

// ── GET /api/v1/bookings/:id (auth required) ──────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { bottleBookingService } = await import('../services/bottleBooking.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const booking = await bottleBookingService.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load booking' });
  }
});

// ── POST /api/v1/bookings/:id/cancel (auth required) ──────────────────────
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { bottleBookingService } = await import('../services/bottleBooking.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const booking = await bottleBookingService.cancelBooking(req.params.id);
    res.json({ success: true, data: booking });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to cancel booking' });
  }
});

// ── POST /api/v1/bookings/:id/check-in (admin/business only) ──────────────
router.post('/:id/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate, authorize } = await import('../middleware/auth.middleware');
    const { bottleBookingService } = await import('../services/bottleBooking.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        authorize('ADMIN', 'BUSINESS_OWNER', 'BUSINESS_STAFF')(req as any, res, (err?: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

    const staffId = (req as any).user?.id;
    const booking = await bottleBookingService.checkInBooking(req.params.id, staffId);
    res.json({ success: true, data: booking });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to check in booking' });
  }
});

export default router;
