"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trustSeal_service_1 = require("../services/trustSeal.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/seal/register
 * Register a new trust seal for a merchant (requires auth).
 */
router.post('/register', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { merchantName, domain, tier } = req.body;
        const merchantId = req.user.id;
        if (!merchantName || !domain) {
            res.status(400).json({ success: false, error: 'merchantName and domain are required' });
            return;
        }
        const { seal, embedCode } = await trustSeal_service_1.trustSealService.registerSeal(merchantId, merchantName, domain, tier);
        res.json({ success: true, data: { seal, embedCode } });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/seal/:sealId/render
 * Renders the seal for embedding. Called by seal-embed.js.
 * This is public, but implements domain whitelisting via referer/origin.
 */
router.get('/:sealId/render', async (req, res, next) => {
    try {
        const { sealId } = req.params;
        const origin = req.headers.origin || req.headers.referer;
        // In production, parse domain properly. For now, simple fallback.
        let requestDomain = '*';
        if (origin) {
            try {
                requestDomain = new URL(origin).hostname;
            }
            catch (e) { }
        }
        const rendered = await trustSeal_service_1.trustSealService.renderSeal(sealId, requestDomain);
        if (!rendered) {
            // Return a blank transparent SVG if unauthorized or inactive
            res.setHeader('Content-Type', 'image/svg+xml');
            res.send('<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg"></svg>');
            return;
        }
        // Return the HTML snippet directly or JSON
        const format = req.query.format;
        // Enable CORS for embedability anywhere
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (format === 'json') {
            res.json({ success: true, data: rendered.data, html: rendered.html });
        }
        else {
            res.setHeader('Content-Type', 'text/html');
            res.send(rendered.html);
        }
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/seal/:sealId/verify
 * Public endpoint for when a user clicks the seal.
 * Returns the full PTP attestation.
 */
router.get('/:sealId/verify', async (req, res, next) => {
    try {
        const { sealId } = req.params;
        const verification = await trustSeal_service_1.trustSealService.verifySeal(sealId);
        if (!verification) {
            res.status(404).json({ success: false, error: 'Seal not found or inactive' });
            return;
        }
        res.json({ success: true, data: verification });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/seal/:sealId/stats
 * Get analytics for a seal (requires auth).
 */
router.get('/:sealId/stats', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { sealId } = req.params;
        const stats = trustSeal_service_1.trustSealService.getSealStats(sealId);
        if (!stats) {
            res.status(404).json({ success: false, error: 'Seal not found' });
            return;
        }
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/seal/pricing
 * Get available seal tiers and pricing.
 */
router.get('/pricing', (_req, res) => {
    res.json({ success: true, data: trustSeal_service_1.trustSealService.getTierPricing() });
});
exports.default = router;
//# sourceMappingURL=seal.routes.js.map