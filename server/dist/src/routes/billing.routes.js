"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_service_1 = require("../services/billing.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/billing/subscribe
 * Create a new billing customer with an API key.
 */
router.post('/subscribe', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { companyName, tier } = req.body;
        const email = req.user.email;
        if (!companyName) {
            res.status(400).json({ success: false, error: 'companyName is required' });
            return;
        }
        const { customer, apiKey } = await billing_service_1.billingService.createCustomer(companyName, email, tier);
        res.json({ success: true, data: { customer, apiKey } });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/billing/usage
 * Get current billing period usage and invoice preview.
 */
router.get('/usage', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { apiKey } = req.query;
        if (!apiKey || typeof apiKey !== 'string') {
            res.status(400).json({ success: false, error: 'apiKey query parameter is required' });
            return;
        }
        const preview = billing_service_1.billingService.getInvoicePreview(apiKey);
        if (!preview) {
            res.status(404).json({ success: false, error: 'Invalid API key or inactive customer' });
            return;
        }
        res.json({ success: true, data: preview });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/billing/stats
 * Admin only: Get platform-wide revenue stats.
 */
router.get('/stats', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        // Basic admin check (could use proper roles)
        if (req.user.email !== 'admin@pabandi.com') {
            res.status(403).json({ success: false, error: 'Admin access required' });
            return;
        }
        const stats = billing_service_1.billingService.getRevenueStats();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/billing/pricing
 * Get available billing tiers and pricing.
 */
router.get('/pricing', (_req, res) => {
    res.json({ success: true, data: billing_service_1.billingService.getTierPricing() });
});
exports.default = router;
//# sourceMappingURL=billing.routes.js.map