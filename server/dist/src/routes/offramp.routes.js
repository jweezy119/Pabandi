"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const offramp_controller_1 = require("../controllers/offramp.controller");
const router = (0, express_1.Router)();
// Middleware: Simple LP API Key check for Phase 0
function lpAuthMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (!apiKey || apiKey !== process.env.OFFRAMP__LP_API_KEY) {
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
// LP Facing Routes
router.get('/lp/stream', lpAuthMiddleware, offramp_controller_1.streamLpIntents);
router.post('/lp/submit-proof/:intentId', lpAuthMiddleware, offramp_controller_1.submitProof);
exports.default = router;
//# sourceMappingURL=offramp.routes.js.map