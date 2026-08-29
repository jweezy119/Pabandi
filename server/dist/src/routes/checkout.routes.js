"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const checkout_controller_1 = require("../controllers/checkout.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const router = (0, express_1.Router)();
// Partner embed checkout: accepts `x-api-key` without existing merchant session.
// Intended for embedded partner checkout calls from Shopify, live selling, freelance, hospitality widgets, etc.
router.post('/embed-checkout/public', apiKey_middleware_1.apiKeyAuth, checkout_controller_1.createPartnerEmbedCheckoutSession);
// Generic internal embed checkout path: currently requires active session.
router.post('/embed-checkout', checkout_controller_1.createEmbedCheckoutSession);
// Create a new checkout session (protected, requires business context)
router.post('/session', auth_middleware_1.authenticate, checkout_controller_1.createCheckoutSession);
router.get('/session/:id', checkout_controller_1.getCheckoutSession);
router.post('/session/:id/complete', checkout_controller_1.completeCheckoutSession);
router.post('/embed-checkout', checkout_controller_1.createEmbedCheckoutSession);
router.post('/embed-checkout/public', apiKey_middleware_1.apiKeyAuth, checkout_controller_1.createPartnerEmbedCheckoutSession);
router.post('/session/:id/stripe', auth_middleware_1.optionalAuthenticate, checkout_controller_1.initiateStripeCheckout);
router.post('/session/:id/crypto', auth_middleware_1.optionalAuthenticate, checkout_controller_1.initiateCryptoCheckout);
router.post('/session/:id/escrow', auth_middleware_1.optionalAuthenticate, checkout_controller_1.initiateEscrowCheckout);
// Deterministic ops/checkout receipt for buyer and seller views
router.get('/session/:id/receipt', checkout_controller_1.getCheckoutReceipt);
// Public demo checkout session for CoCreate walkthroughs
router.post('/session/demo', checkout_controller_1.createDemoCheckoutSession);
exports.default = router;
//# sourceMappingURL=checkout.routes.js.map