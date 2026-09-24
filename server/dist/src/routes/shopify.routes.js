"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shopify_controller_1 = require("../controllers/shopify.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// OAuth initiation
router.get('/auth', shopify_controller_1.shopifyAuth);
// OAuth callback
router.get('/callback', shopify_controller_1.shopifyAuthCallback);
// Connect Store to Business
router.post('/connect', auth_middleware_1.authenticate, shopify_controller_1.connectShopifyStore);
// Webhooks
router.post('/webhooks', shopify_controller_1.shopifyWebhooks);
// VC Verification endpoints for Shopify Checkout App blocks
router.post('/verify/session', shopify_controller_1.createVerificationSession);
router.post('/verify/callback', shopify_controller_1.verificationCallback);
exports.default = router;
//# sourceMappingURL=shopify.routes.js.map