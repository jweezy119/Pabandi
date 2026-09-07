import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ── POST /api/v1/guest-list (auth required) ───────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { guestListService } = await import('../services/guestList.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const entry = await guestListService.addToGuestList({
      userId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to add to guest list' });
  }
});

// ── GET /api/v1/guest-list/my-entries (auth required) ─────────────────────
router.get('/my-entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { guestListService } = await import('../services/guestList.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const entries = await guestListService.getGuestListByUser(userId);
    res.json({ success: true, data: entries });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load entries' });
  }
});

// ── GET /api/v1/guest-list/venue/:venueId (admin/business only) ───────────
router.get('/venue/:venueId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate, authorize } = await import('../middleware/auth.middleware');
    const { guestListService } = await import('../services/guestList.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        authorize('ADMIN', 'BUSINESS_OWNER', 'BUSINESS_STAFF')(req as any, res, (err?: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

    const { date } = req.query;
    const guestList = await guestListService.getGuestList(req.params.venueId, date as string | undefined);
    res.json({ success: true, data: guestList });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load guest list' });
  }
});

// ── POST /api/v1/guest-list/:id/confirm ───────────────────────────────────
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guestListService } = await import('../services/guestList.service');
    const entry = await guestListService.confirmGuestListEntry(req.params.id);
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to confirm entry' });
  }
});

// ── POST /api/v1/guest-list/:id/check-in ──────────────────────────────────
router.post('/:id/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guestListService } = await import('../services/guestList.service');
    const entry = await guestListService.checkInGuest(req.params.id);
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to check in guest' });
  }
});

// ── POST /api/v1/guest-list/:id/cancel ────────────────────────────────────
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guestListService } = await import('../services/guestList.service');
    const entry = await guestListService.cancelGuestListEntry(req.params.id);
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to cancel entry' });
  }
});

export default router;
