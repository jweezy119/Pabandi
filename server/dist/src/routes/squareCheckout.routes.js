"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const squareCheckout_controller_1 = require("../controllers/squareCheckout.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Webhook endpoint — NO auth (Square calls this externally)
router.post('/webhook', squareCheckout_controller_1.handleSquareWebhook);
// Protected routes (require auth)
router.post('/checkout', auth_middleware_1.authenticate, squareCheckout_controller_1.createSquareCheckout);
router.get('/payment/:paymentId', auth_middleware_1.authenticate, squareCheckout_controller_1.getSquarePayment);
router.post('/refund', auth_middleware_1.authenticate, squareCheckout_controller_1.createSquareRefund);
exports.default = router;
//# sourceMappingURL=squareCheckout.routes.js.map