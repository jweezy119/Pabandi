// Sitara OS — API Routes for frugal open-source map/geocode/email services.
// Some endpoints are public; email endpoints require authentication.

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  geocodeAddress,
  reverseGeocode,
  searchPOI,
  discoverBusinesses,
  getRoute,
  getDistanceMatrix,
  getIsochrone,
  sendBookingConfirmation,
  sendPromoEmail,
} from '../services/sitaraApiService';

const router = Router();

// ── Public: Geocode address ────────────────────────────────────────────────
router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: 'q parameter required' });
    }

    const results = await geocodeAddress(q);
    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'No results found' });
    }

    return res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] geocode error:', err?.message);
    return res.status(500).json({ success: false, error: 'Geocoding service unavailable' });
  }
});

// ── Public: Reverse geocode ────────────────────────────────────────────────
router.get('/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const result = await reverseGeocode(lat, lng);
    if (!result) {
      return res.status(404).json({ success: false, error: 'No result for location' });
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] reverse-geocode error:', err?.message);
    return res.status(500).json({ success: false, error: 'Reverse geocoding service unavailable' });
  }
});

// ── Public: Search POI ─────────────────────────────────────────────────────
router.get('/poi', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : undefined;

    if (!q) {
      return res.status(400).json({ success: false, error: 'q parameter required' });
    }

    const results = await searchPOI(q, lat, lng, radius);
    return res.json({ success: true, data: results });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] poi error:', err?.message);
    return res.status(500).json({ success: false, error: 'POI search unavailable' });
  }
});

// ── Public: Discover nearby businesses from OSM ────────────────────────────
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5000;
    const category = req.query.category as string | undefined;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const businesses = await discoverBusinesses(lat, lng, radius, category);
    return res.json({ success: true, data: businesses, count: businesses.length });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] discover error:', err?.message);
    return res.status(500).json({ success: false, error: 'Business discovery unavailable' });
  }
});

// ── Public: Distance between two points ────────────────────────────────────
router.get('/distance', async (req: Request, res: Response) => {
  try {
    const fromLat = parseFloat(req.query.from_lat as string);
    const fromLng = parseFloat(req.query.from_lng as string);
    const toLat = parseFloat(req.query.to_lat as string);
    const toLng = parseFloat(req.query.to_lng as string);

    if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
      return res.status(400).json({
        success: false,
        error: 'from_lat, from_lng, to_lat, to_lng parameters required',
      });
    }

    const result = await getRoute({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
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
    console.error('[SitaraApiRoutes] distance error:', err?.message);
    return res.status(500).json({ success: false, error: 'Distance calculation unavailable' });
  }
});

// ── Public: Isochrone (reachable area) ─────────────────────────────────────
router.get('/isochrone', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const minutes = req.query.minutes ? parseFloat(req.query.minutes as string) : 15;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
    }

    const result = await getIsochrone(lat, lng, minutes);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Isochrone calculation failed' });
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] isochrone error:', err?.message);
    return res.status(500).json({ success: false, error: 'Isochrone service unavailable' });
  }
});

// ── Auth: Send booking confirmation email ──────────────────────────────────
router.post('/send-confirmation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, businessName, date, time, guests } = req.body;

    if (!to || !businessName || !date || !time || guests == null) {
      return res.status(400).json({
        success: false,
        error: 'to, businessName, date, time, guests are required',
      });
    }

    const sent = await sendBookingConfirmation({ to, businessName, date, time, guests });
    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send email' });
    }

    return res.json({ success: true, data: { message: 'Booking confirmation sent' } });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] send-confirmation error:', err?.message);
    return res.status(500).json({ success: false, error: 'Email service unavailable' });
  }
});

// ── Auth: Send promo email ─────────────────────────────────────────────────
router.post('/send-promo', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, businessName, promoTitle, promoDescription } = req.body;

    if (!to || !businessName || !promoTitle) {
      return res.status(400).json({
        success: false,
        error: 'to, businessName, promoTitle are required',
      });
    }

    const sent = await sendPromoEmail({ to, businessName, promoTitle, promoDescription: promoDescription || '' });
    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send email' });
    }

    return res.json({ success: true, data: { message: 'Promo email sent' } });
  } catch (err: any) {
    console.error('[SitaraApiRoutes] send-promo error:', err?.message);
    return res.status(500).json({ success: false, error: 'Email service unavailable' });
  }
});

export default router;
