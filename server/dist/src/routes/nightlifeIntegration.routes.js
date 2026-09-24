"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nightlifeIntegration_service_1 = require("../services/nightlifeIntegration.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════
// PROMOTER OS — Dashboard & Management
// ═══════════════════════════════════════════════════════════════════════════
// Get promoter dashboard with stats
router.get('/promoter/:id/dashboard', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const dashboard = await nightlifeIntegration_service_1.nightlifeIntegrationService.getPromoterDashboard(req.params.id);
        if (!dashboard)
            return res.status(404).json({ error: 'Promoter not found' });
        res.json({ success: true, data: dashboard });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});
// Create promoter profile
router.post('/promoter', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const promoter = await nightlifeIntegration_service_1.nightlifeIntegrationService.createPromoterProfile(req.user?.id, req.body);
        res.status(201).json({ success: true, data: promoter });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create promoter profile' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// GUEST LIST — Smart Lists with Deposits, QR, Entry Verification
// ═══════════════════════════════════════════════════════════════════════════
// Create smart guest list (with no-show prediction)
router.post('/guest-list/smart', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const guestList = await nightlifeIntegration_service_1.nightlifeIntegrationService.createSmartGuestList({
            userId,
            ...req.body,
        });
        res.status(201).json({ success: true, data: guestList });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to create guest list' });
    }
});
// Generate QR code for entry
router.get('/guest-list/:id/qr', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const qr = await nightlifeIntegration_service_1.nightlifeIntegrationService.generateQRCode(req.params.id);
        if (!qr)
            return res.status(404).json({ error: 'Guest list not found' });
        res.json({ success: true, data: qr });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to generate QR' });
    }
});
// Verify entry at door (venue scans QR)
router.post('/guest-list/verify', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { confirmationCode, venueId } = req.body;
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.verifyEntry(confirmationCode, venueId);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to verify entry' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// VENUE DASHBOARD — Real-time Capacity, Analytics
// ═══════════════════════════════════════════════════════════════════════════
// Get venue dashboard (real-time arrivals, capacity, revenue)
router.get('/venue/:id/dashboard', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const dashboard = await nightlifeIntegration_service_1.nightlifeIntegrationService.getVenueDashboard(req.params.id);
        if (!dashboard)
            return res.status(404).json({ error: 'Venue not found' });
        res.json({ success: true, data: dashboard });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to load venue dashboard' });
    }
});
// Get real-time capacity
router.get('/venue/:id/capacity', async (req, res) => {
    try {
        const capacity = await nightlifeIntegration_service_1.nightlifeIntegrationService.getRealTimeCapacity(req.params.id);
        if (!capacity)
            return res.status(404).json({ error: 'Venue not found' });
        res.json({ success: true, data: capacity });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get capacity' });
    }
});
// Add to waitlist
router.post('/venue/:id/waitlist', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { partySize } = req.body;
        const waitlist = await nightlifeIntegration_service_1.nightlifeIntegrationService.addToWaitlist(req.params.id, userId, partySize);
        res.status(201).json({ success: true, data: waitlist });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to add to waitlist' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION RAILS — WhatsApp, Instagram, Eventbrite, SMS
// ═══════════════════════════════════════════════════════════════════════════
// Send WhatsApp confirmation
router.post('/guest-list/:id/whatsapp', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { phone } = req.body;
        // In production: look up guest list and send
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.sendWhatsAppConfirmation(phone, {});
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to send WhatsApp' });
    }
});
// Send SMS confirmation
router.post('/guest-list/:id/sms', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { phone } = req.body;
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.sendSMSConfirmation(phone, {});
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});
// Sync Instagram venue data
router.get('/venue/:id/instagram', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { handle } = req.query;
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.syncInstagramVenue(handle);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to sync Instagram' });
    }
});
// Sync Eventbrite event
router.get('/events/sync-eventbrite/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.syncEventbriteEvent(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to sync Eventbrite' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// FRAUD DETECTION — Promoter Risk Scoring
// ═══════════════════════════════════════════════════════════════════════════
// Check promoter fraud risk
router.get('/promoter/:id/fraud-check', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.checkPromoterFraud(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to check promoter' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// PROMOTER PAYOUTS — Commission Tracking
// ═══════════════════════════════════════════════════════════════════════════
// Calculate promoter payout
router.get('/promoter/:id/payout', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { venueId, date } = req.query;
        const result = await nightlifeIntegration_service_1.nightlifeIntegrationService.calculatePromoterPayout(req.params.id, venueId, date);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to calculate payout' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// EVENT DISCOVERY — Multi-source
// ═══════════════════════════════════════════════════════════════════════════
// Discover events from all sources
router.get('/events/discover', async (req, res) => {
    try {
        const { city, date, source } = req.query;
        const events = await nightlifeIntegration_service_1.nightlifeIntegrationService.discoverEvents({
            city: city,
            date: date,
            source: source,
        });
        res.json({ success: true, data: events });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to discover events' });
    }
});
exports.default = router;
//# sourceMappingURL=nightlifeIntegration.routes.js.map