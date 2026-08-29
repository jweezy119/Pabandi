"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const env_1 = require("../utils/env");
const router = (0, express_1.Router)();
router.post('/webhook', express_2.default.raw({ type: 'application/json', verify: (req, _res, buf) => { req.rawBody = buf; } }), payment_controller_1.processPaymentWebhook);
if ((0, env_1.isDemoMode)()) {
    router.post('/simulate-webhook', express_2.default.raw({ type: 'application/json', verify: (req, _res, buf) => { req.rawBody = buf; } }), payment_controller_1.processPaymentWebhook);
}
router.use(auth_middleware_1.authenticate);
router.post('/', payment_controller_1.createPayment);
router.get('/:id', payment_controller_1.getPayment);
router.post('/subscription-checkout', payment_controller_1.createSubscriptionCheckout);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map