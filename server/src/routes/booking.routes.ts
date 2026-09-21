import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  createBooking,
  confirmBookingPayment,
  getBookingStatus,
  releaseBookingEscrow,
} from '../controllers/booking.controller';
import { bookingService } from '../services/booking.service';
import { ap2Middleware } from '../middleware/payment';

const router = Router();

// ── Booking creation/confirmation routes ───────────────────────────────────

// POST /api/v1/booking/create — create booking + deposit payment
router.post('/create', authenticate, ap2Middleware, async (req: Request, res: Response, next: NextFunction) => {
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

// ── BookingOS: Geocode address ─────────────────────────────────────────────
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: 'q parameter required' });
    }

    const results = await bookingService.geocodeAddress(q);
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'No results found' });
    }

    return res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[BookingRoutes] geocode error:', err?.message);
    return res.status(500).json({ success: false, error: 'Geocoding service unavailable' });
  }
});

// ── BookingOS: Reverse geocode ─────────────────────────────────────────────
router.get('/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const result = await bookingService.reverseGeocode(lat, lng);
    if (!result) {
      return res.status(404).json({ success: false, error: 'No result for location' });
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[BookingRoutes] reverse-geocode error:', err?.message);
    return res.status(500).json({ success: false, error: 'Reverse geocoding service unavailable' });
  }
});

// ── BookingOS: Search POI ──────────────────────────────────────────────────
router.get('/poi', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

    if (!q) {
      return res.status(400).json({ success: false, error: 'q parameter required' });
    }

    const results = await bookingService.searchPOI(q, lat, lng, radius);
    return res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[BookingRoutes] poi error:', err?.message);
    return res.status(500).json({ success: false, error: 'POI search unavailable' });
  }
});

// ── BookingOS: Discover nearby businesses from OSM ─────────────────────────
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5000;
    const category = req.query.category as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const businesses = await bookingService.discoverBusinesses(lat, lng, radius, category);
    return res.json({ success: true, data: businesses, count: businesses.length });
  } catch (err: any) {
    console.error('[BookingRoutes] discover error:', err?.message);
    return res.status(500).json({ success: false, error: 'Business discovery unavailable' });
  }
});

// ── BookingOS: Distance between two points ─────────────────────────────────
router.get('/distance', async (req: Request, res: Response) => {
  try {
    const fromLat = parseFloat(req.query.from_lat as string);
    const fromLng = parseFloat(req.query.from_lng as string);
    const toLat = parseFloat(req.query.to_lat as string);
    const toLng = parseFloat(req.query.to_lng as string);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return res.status(400).json({ success: false, error: 'from_lat, from_lng, to_lat, to_lng parameters required' });
    }

    const result = await bookingService.getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
    if (!result) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    return res.json({
      success: true,
      data: {
        distanceMeters: result.distance,
        durationSeconds: result.duration,
        distanceKm: +(result.distance / 1000).toFixed(2),
        durationMinutes: +(result.duration / 60).toFixed(1),
      },
    });
  } catch (err: any) {
    console.error('[BookingRoutes] distance error:', err?.message);
    return res.status(500).json({ success: false, error: 'Distance calculation unavailable' });
  }
});

// ── BookingOS: Isochrone (reachable area) ──────────────────────────────────
router.get('/isochrone', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const minutes = req.query.minutes ? parseFloat(req.query.minutes as string) : 15;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const result = await bookingService.getIsochrone(lat, lng, minutes);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Isochrone calculation failed' });
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[BookingRoutes] isochrone error:', err?.message);
    return res.status(500).json({ success: false, error: 'Isochrone service unavailable' });
  }
});

// ── BookingOS: Send booking confirmation email ─────────────────────────────
router.post('/send-confirmation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, businessName, date, time, guests } = req.body;

    if (!to || !businessName || !date || !time || guests == null) {
      return res.status(400).json({ success: false, error: 'to, businessName, date, time, guests are required' });
    }

    const sent = await bookingService.sendBookingConfirmation({ to, businessName, date, time, guests });
    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send email' });
    }

    return res.json({ success: true, data: { message: 'Booking confirmation sent' } });
  } catch (err: any) {
    console.error('[BookingRoutes] send-confirmation error:', err?.message);
    return res.status(500).json({ success: false, error: 'Email service unavailable' });
  }
});

// ── BookingOS: Send promo email ────────────────────────────────────────────
router.post('/send-promo', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, businessName, promoTitle, promoDescription } = req.body;

    if (!to || !businessName || !promoTitle) {
      return res.status(400).json({ success: false, error: 'to, businessName, promoTitle are required' });
    }

    const sent = await bookingService.sendPromoEmail({ to, businessName, promoTitle, promoDescription: promoDescription || '' });
    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send email' });
    }

    return res.json({ success: true, data: { message: 'Promo email sent' } });
  } catch (err: any) {
    console.error('[BookingRoutes] send-promo error:', err?.message);
    return res.status(500).json({ success: false, error: 'Email service unavailable' });
  }
});

export default router;
