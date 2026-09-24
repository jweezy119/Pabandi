"use strict";
// Sitara OS — API Routes for frugal open-source map/geocode/email services.
// Some endpoints are public; email endpoints require authentication.
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const sitaraApiService_1 = require("../services/sitaraApiService");
const router = (0, express_1.Router)();
// ── Public: Geocode address ────────────────────────────────────────────────
router.get('/geocode', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ success: false, error: 'q parameter required' });
        }
        const results = await (0, sitaraApiService_1.geocodeAddress)(q);
        if (results.length === 0) {
            return res.status(404).json({ success: false, error: 'No results found' });
        }
        return res.json({ success: true, data: results });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] geocode error:', err?.message);
        return res.status(500).json({ success: false, error: 'Geocoding service unavailable' });
    }
});
// ── Public: Reverse geocode ────────────────────────────────────────────────
router.get('/reverse-geocode', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
        }
        const result = await (0, sitaraApiService_1.reverseGeocode)(lat, lng);
        if (!result) {
            return res.status(404).json({ success: false, error: 'No result for location' });
        }
        return res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] reverse-geocode error:', err?.message);
        return res.status(500).json({ success: false, error: 'Reverse geocoding service unavailable' });
    }
});
// ── Public: Search POI ─────────────────────────────────────────────────────
router.get('/poi', async (req, res) => {
    try {
        const q = req.query.q;
        const lat = req.query.lat ? parseFloat(req.query.lat) : undefined;
        const lng = req.query.lng ? parseFloat(req.query.lng) : undefined;
        const radius = req.query.radius ? parseFloat(req.query.radius) : undefined;
        if (!q) {
            return res.status(400).json({ success: false, error: 'q parameter required' });
        }
        const results = await (0, sitaraApiService_1.searchPOI)(q, lat, lng, radius);
        return res.json({ success: true, data: results });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] poi error:', err?.message);
        return res.status(500).json({ success: false, error: 'POI search unavailable' });
    }
});
// ── Public: Discover nearby businesses from OSM ────────────────────────────
router.get('/discover', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radius = req.query.radius ? parseFloat(req.query.radius) : 5000;
        const category = req.query.category;
        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
        }
        const businesses = await (0, sitaraApiService_1.discoverBusinesses)(lat, lng, radius, category);
        return res.json({ success: true, data: businesses, count: businesses.length });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] discover error:', err?.message);
        return res.status(500).json({ success: false, error: 'Business discovery unavailable' });
    }
});
// ── Public: Distance between two points ────────────────────────────────────
router.get('/distance', async (req, res) => {
    try {
        const fromLat = parseFloat(req.query.from_lat);
        const fromLng = parseFloat(req.query.from_lng);
        const toLat = parseFloat(req.query.to_lat);
        const toLng = parseFloat(req.query.to_lng);
        if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
            return res.status(400).json({
                success: false,
                error: 'from_lat, from_lng, to_lat, to_lng parameters required',
            });
        }
        const result = await (0, sitaraApiService_1.getRoute)({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
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
    }
    catch (err) {
        console.error('[SitaraApiRoutes] distance error:', err?.message);
        return res.status(500).json({ success: false, error: 'Distance calculation unavailable' });
    }
});
// ── Public: Isochrone (reachable area) ─────────────────────────────────────
router.get('/isochrone', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const minutes = req.query.minutes ? parseFloat(req.query.minutes) : 15;
        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ success: false, error: 'lat and lng parameters required' });
        }
        const result = await (0, sitaraApiService_1.getIsochrone)(lat, lng, minutes);
        if (!result) {
            return res.status(404).json({ success: false, error: 'Isochrone calculation failed' });
        }
        return res.json({ success: true, data: result });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] isochrone error:', err?.message);
        return res.status(500).json({ success: false, error: 'Isochrone service unavailable' });
    }
});
// ── Auth: Send booking confirmation email ──────────────────────────────────
router.post('/send-confirmation', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { to, businessName, date, time, guests } = req.body;
        if (!to || !businessName || !date || !time || guests == null) {
            return res.status(400).json({
                success: false,
                error: 'to, businessName, date, time, guests are required',
            });
        }
        const sent = await (0, sitaraApiService_1.sendBookingConfirmation)({ to, businessName, date, time, guests });
        if (!sent) {
            return res.status(502).json({ success: false, error: 'Failed to send email' });
        }
        return res.json({ success: true, data: { message: 'Booking confirmation sent' } });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] send-confirmation error:', err?.message);
        return res.status(500).json({ success: false, error: 'Email service unavailable' });
    }
});
// ── Auth: Send promo email ─────────────────────────────────────────────────
router.post('/send-promo', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { to, businessName, promoTitle, promoDescription } = req.body;
        if (!to || !businessName || !promoTitle) {
            return res.status(400).json({
                success: false,
                error: 'to, businessName, promoTitle are required',
            });
        }
        const sent = await (0, sitaraApiService_1.sendPromoEmail)({ to, businessName, promoTitle, promoDescription: promoDescription || '' });
        if (!sent) {
            return res.status(502).json({ success: false, error: 'Failed to send email' });
        }
        return res.json({ success: true, data: { message: 'Promo email sent' } });
    }
    catch (err) {
        console.error('[SitaraApiRoutes] send-promo error:', err?.message);
        return res.status(500).json({ success: false, error: 'Email service unavailable' });
    }
});
exports.default = router;
//# sourceMappingURL=sitaraApi.routes.js.map