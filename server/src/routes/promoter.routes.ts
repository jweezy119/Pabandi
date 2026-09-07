import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ── POST /api/v1/promoters/register (auth required) ───────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.registerPromoter(userId, req.body);
    res.status(201).json({ success: true, data: promoter });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(400).json({ success: false, error: err.message || 'Failed to register promoter' });
  }
});

// ── GET /api/v1/promoters/me (auth required) ──────────────────────────────
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.getPromoterByUserId(userId);
    if (!promoter) {
      return res.status(404).json({ success: false, error: 'Promoter profile not found' });
    }
    res.json({ success: true, data: promoter });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load promoter profile' });
  }
});

// ── GET /api/v1/promoters/stats (auth required) ───────────────────────────
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.getPromoterByUserId(userId);
    if (!promoter) {
      return res.status(404).json({ success: false, error: 'Promoter profile not found' });
    }

    const stats = await promoterService.getPromoterStats(promoter.id);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load stats' });
  }
});

// ── GET /api/v1/promoters/bookings (auth required) ────────────────────────
router.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.getPromoterByUserId(userId);
    if (!promoter) {
      return res.status(404).json({ success: false, error: 'Promoter profile not found' });
    }

    const bookings = await promoterService.getPromoterBookings(promoter.id);
    res.json({ success: true, data: bookings });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load bookings' });
  }
});

// ── GET /api/v1/promoters/wallet (auth required) ──────────────────────────
router.get('/wallet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.getPromoterByUserId(userId);
    if (!promoter) {
      return res.status(404).json({ success: false, error: 'Promoter profile not found' });
    }

    const wallet = await promoterService.getPromoterWallet(promoter.id);
    res.json({ success: true, data: wallet });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to load wallet' });
  }
});

// ── GET /api/v1/promoters/leaderboard ─────────────────────────────────────
router.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { promoterService } = await import('../services/promoter.service');
    const { limit } = req.query;
    const leaderboard = await promoterService.getPromoterLeaderboard(limit ? Number(limit) : 10);
    res.json({ success: true, data: leaderboard });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load leaderboard' });
  }
});

// ── GET /api/v1/promoters/ref-link (auth required) ────────────────────────
router.get('/ref-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate } = await import('../middleware/auth.middleware');
    const { promoterService } = await import('../services/promoter.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const userId = (req as any).user?.id;
    const promoter = await promoterService.getPromoterByUserId(userId);
    if (!promoter) {
      return res.status(404).json({ success: false, error: 'Promoter profile not found' });
    }

    const promoCode = await promoterService.generateReferralCode(promoter.id);
    res.json({ success: true, data: promoCode });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('token')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to generate referral link' });
  }
});

export default router;
