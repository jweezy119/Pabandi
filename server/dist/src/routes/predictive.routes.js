"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * predictive.routes.ts — Predictive Intelligence API.
 *
 *   GET /api/v1/predictive/customer/:id/risk     — per-customer no-show risk
 *   GET /api/v1/predictive/business/:id/risk     — per-business reliability
 *   POST /api/v1/predictive/booking              — forward prediction for a
 *                                                   PROSPECTIVE booking
 *   GET /api/v1/predictive/business/:id/demand    — hourly demand forecast
 *   POST /api/v1/predictive/recommend-slots       — optimal slot suggestions
 *
 * Open-source: pure Postgres aggregates, no external ML dependency.
 */
const express_1 = require("express");
const predictiveTrust_service_1 = require("../services/predictiveTrust.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Per-customer risk (auth: the requester must be the customer or an admin/owner)
router.get('/customer/:id/risk', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const risk = await predictiveTrust_service_1.predictiveTrustService.customerRisk(req.params.id);
        res.json({ success: true, data: risk });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Per-business reliability (public-ish; auth gate to avoid scrapers)
router.get('/business/:id/risk', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const risk = await predictiveTrust_service_1.predictiveTrustService.businessRisk(req.params.id);
        res.json({ success: true, data: risk });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Forward prediction for a prospective booking (no auth needed for the model,
// but require a valid session to avoid open enumeration). Provide minimal input.
router.post('/booking', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { customerId, businessId, reservationTime } = req.body ?? {};
        const pred = await predictiveTrust_service_1.predictiveTrustService.predictBooking({ customerId, businessId, reservationTime });
        res.json({ success: true, data: pred });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Hourly demand forecast for a business
router.get('/business/:id/demand', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const demand = await predictiveTrust_service_1.predictiveTrustService.demandForecast(req.params.id);
        res.json({ success: true, data: demand });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Optimal slot recommendation
router.post('/recommend-slots', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { customerId, businessId, daysAhead } = req.body ?? {};
        if (!businessId)
            return res.status(400).json({ success: false, error: 'businessId required' });
        const slots = await predictiveTrust_service_1.predictiveTrustService.recommendSlots({ customerId, businessId, daysAhead });
        res.json({ success: true, data: { slots } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=predictive.routes.js.map