"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const offramp_controller_1 = require("../controllers/offramp.controller");
const logger_1 = require("../utils/logger");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// ── LP API Key auth (header only — never accept via query param) ──────────────
function lpAuthMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ success: false, error: 'Unauthorized LP' });
    }
    const expected = process.env.OFFRAMP__LP_API_KEY;
    if (!expected) {
        logger_1.logger.error('[Offramp] OFFRAMP__LP_API_KEY is not configured — LP auth cannot verify');
        return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }
    // Constant-time comparison to avoid timing attacks on the API key
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(apiKey);
    if (expectedBuf.length !== providedBuf.length || !expectedBuf.equals(providedBuf)) {
        return res.status(401).json({ success: false, error: 'Unauthorized LP' });
    }
    next();
}
// Admin / Internal Routes
router.post('/intent', auth_middleware_1.authenticate, offramp_controller_1.createIntent);
router.post('/lp/match/:intentId', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), offramp_controller_1.matchLp);
router.post('/lp/accept-proof', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), offramp_controller_1.acceptProof);
router.post('/admin/expire-stale', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), offramp_controller_1.expireStaleIntents);
router.get('/providers', auth_middleware_1.authenticate, offramp_controller_1.listProviders);
router.post('/providers/register', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), offramp_controller_1.registerProvider);
router.post('/dev/test-webhook', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), offramp_controller_1.testWebhookDelivery);
router.post('/webhook/emi', offramp_controller_1.emiWebhook);
router.post('/settlement/receipt', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), offramp_controller_1.createSettlementReceipt);
router.post('/quote', auth_middleware_1.authenticate, offramp_controller_1.getOfframpQuote);
// LP Facing Routes — rate-limited at the IP level before LP key check
router.get('/lp/stream', rateLimiter_1.lpAuthRateLimiter, lpAuthMiddleware, offramp_controller_1.streamLpIntents);
router.post('/lp/submit-proof/:intentId', rateLimiter_1.lpAuthRateLimiter, lpAuthMiddleware, offramp_controller_1.submitProof);
exports.default = router;
//# sourceMappingURL=offramp.routes.js.map