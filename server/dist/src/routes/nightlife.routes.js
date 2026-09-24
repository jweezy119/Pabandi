"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nightlife_service_1 = require("../services/nightlife.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Venues ────────────────────────────────────────────────────────────────
router.get('/venues', async (req, res) => {
    try {
        const { city, type, genre } = req.query;
        const venues = await nightlife_service_1.nightlifeService.listVenues({
            city: city,
            type: type,
            genre: genre,
        });
        res.json({ success: true, data: venues });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load venues' });
    }
});
router.get('/venues/:id', async (req, res) => {
    try {
        const venue = await nightlife_service_1.nightlifeService.getVenue(req.params.id);
        if (!venue)
            return res.status(404).json({ error: 'Venue not found' });
        res.json({ success: true, data: venue });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load venue' });
    }
});
router.post('/venues', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const venue = await nightlife_service_1.nightlifeService.createVenue(req.body);
        res.status(201).json({ success: true, data: venue });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create venue' });
    }
});
// ── Bottle Service ─────────────────────────────────────────────────────────
router.get('/venues/:id/tables', async (req, res) => {
    try {
        const { date, guests } = req.query;
        const tables = await nightlife_service_1.nightlifeService.getAvailableTables(req.params.id, date, Number(guests) || 2);
        res.json({ success: true, data: tables });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load tables' });
    }
});
router.post('/bottle-packages', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const pkg = await nightlife_service_1.nightlifeService.createBottlePackage(req.body);
        res.status(201).json({ success: true, data: pkg });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create package' });
    }
});
router.post('/bottle-reservations', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const reservation = await nightlife_service_1.nightlifeService.createBottleReservation({
            userId,
            ...req.body,
        });
        res.status(201).json({ success: true, data: reservation });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create reservation' });
    }
});
// ── Cover Charge ───────────────────────────────────────────────────────────
router.get('/venues/:id/cover', async (req, res) => {
    try {
        const { date, time, gender, guestList, vip } = req.query;
        const charge = await nightlife_service_1.nightlifeService.getCoverCharge(req.params.id, {
            date: date || new Date().toISOString().split('T')[0],
            time: time,
            gender: gender,
            isGuestList: guestList === 'true',
            isVIP: vip === 'true',
        });
        res.json({ success: true, data: charge });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get cover charge' });
    }
});
router.post('/cover-charges', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const charge = await nightlife_service_1.nightlifeService.createCoverCharge(req.body);
        res.status(201).json({ success: true, data: charge });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create cover charge' });
    }
});
// ── Guest List ─────────────────────────────────────────────────────────────
router.post('/guest-list', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const guestList = await nightlife_service_1.nightlifeService.addToGuestList({
            userId,
            ...req.body,
        });
        res.status(201).json({ success: true, data: guestList });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to add to guest list' });
    }
});
// ── Events ─────────────────────────────────────────────────────────────────
router.get('/events', async (req, res) => {
    try {
        const { venueId, date, city } = req.query;
        const events = await nightlife_service_1.nightlifeService.listEvents({
            venueId: venueId,
            date: date,
            city: city,
        });
        res.json({ success: true, data: events });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load events' });
    }
});
router.post('/events', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const event = await nightlife_service_1.nightlifeService.createEvent(req.body);
        res.status(201).json({ success: true, data: event });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create event' });
    }
});
// ── Demand Forecasting ─────────────────────────────────────────────────────
router.get('/venues/:id/forecast', async (req, res) => {
    try {
        const { days } = req.query;
        const forecast = await nightlife_service_1.nightlifeService.forecastDemand(req.params.id, Number(days) || 7);
        res.json({ success: true, data: forecast });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get forecast' });
    }
});
// ── Wait Time ──────────────────────────────────────────────────────────────
router.get('/venues/:id/wait-time', async (req, res) => {
    try {
        const waitTime = await nightlife_service_1.nightlifeService.estimateWaitTime(req.params.id);
        res.json({ success: true, data: waitTime });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to estimate wait time' });
    }
});
// ── Recommendations ───────────────────────────────────────────────────────
router.get('/recommendations', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { limit } = req.query;
        const recommendations = await nightlife_service_1.nightlifeService.getRecommendations(userId, Number(limit) || 10);
        res.json({ success: true, data: recommendations });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});
// ── Fraud Detection ───────────────────────────────────────────────────────
router.get('/promoters/:id/fraud-check', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await nightlife_service_1.nightlifeService.detectFraudulentPromoter(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to check promoter' });
    }
});
// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/venues/:id/stats', async (req, res) => {
    try {
        const stats = await nightlife_service_1.nightlifeService.getVenueStats(req.params.id);
        res.json({ success: true, data: stats });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load stats' });
    }
});
exports.default = router;
//# sourceMappingURL=nightlife.routes.js.map