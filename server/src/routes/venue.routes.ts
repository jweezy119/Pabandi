import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ── GET /api/v1/venues/search ─────────────────────────────────────────────
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueService } = await import('../services/venue.service');
    const { city, type, date, capacity, genre, amenities, featured, limit, offset } = req.query;

    const filters = {
      city: city as string | undefined,
      type: type as string | undefined,
      date: date as string | undefined,
      capacity: capacity ? Number(capacity) : undefined,
      genre: genre as string | undefined,
      amenities: amenities ? (amenities as string).split(',') : undefined,
      featured: featured !== undefined ? featured === 'true' : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };

    const venues = await venueService.searchVenues(filters);
    res.json({ success: true, data: venues });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to search venues' });
  }
});

// ── GET /api/v1/venues/featured ───────────────────────────────────────────
router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueService } = await import('../services/venue.service');
    const { city } = req.query;
    const venues = await venueService.getFeaturedVenues(city as string | undefined);
    res.json({ success: true, data: venues });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load featured venues' });
  }
});

// ── GET /api/v1/venues/:id ────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueService } = await import('../services/venue.service');
    const venue = await venueService.getVenueById(req.params.id);
    if (!venue) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    res.json({ success: true, data: venue });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to load venue' });
  }
});

// ── GET /api/v1/venues/:id/availability ───────────────────────────────────
router.get('/:id/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { venueService } = await import('../services/venue.service');
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: 'date query parameter is required' });
    }
    const availability = await venueService.getVenueAvailability(req.params.id, date as string);
    res.json({ success: true, data: availability });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to check availability' });
  }
});

// ── POST /api/v1/venues (admin only) ──────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate, authorize } = await import('../middleware/auth.middleware');
    const { venueService } = await import('../services/venue.service');

    // Apply auth middleware inline
    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        authorize('ADMIN')(req as any, res, (err?: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

    const venue = await venueService.createVenue(req.body);
    res.status(201).json({ success: true, data: venue });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to create venue' });
  }
});

// ── PUT /api/v1/venues/:id (admin only) ───────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { authenticate, authorize } = await import('../middleware/auth.middleware');
    const { venueService } = await import('../services/venue.service');

    await new Promise<void>((resolve, reject) => {
      authenticate(req as any, res, (err?: any) => {
        if (err) return reject(err);
        authorize('ADMIN')(req as any, res, (err?: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

    const venue = await venueService.updateVenue(req.params.id, req.body);
    res.json({ success: true, data: venue });
  } catch (err: any) {
    if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
      return res.status(401).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message || 'Failed to update venue' });
  }
});

export default router;
