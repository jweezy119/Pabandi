"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const payment_controller_1 = require("../controllers/payment.controller");
const router = (0, express_1.Router)();
// ── Payment Routes ──────────────────────────────────────────────────────────
// POST /api/v1/payments/create — create payment request (USDC/BTCPay/Manual)
router.post('/create', auth_middleware_1.optionalAuthenticate, payment_controller_1.createPaymentRequest);
// GET /api/v1/payments/:id/status — check payment status
router.get('/:id/status', auth_middleware_1.optionalAuthenticate, payment_controller_1.getPaymentStatus);
// POST /api/v1/payments/:id/verify — verify payment on-chain
router.post('/:id/verify', auth_middleware_1.optionalAuthenticate, payment_controller_1.verifyPayment);
// GET /api/v1/payments/:id — get payment details
router.get('/:id', auth_middleware_1.optionalAuthenticate, payment_controller_1.getPaymentById);
// POST /api/v1/payments/paylio/create — create PayLio fiat payment
router.post('/paylio/create', auth_middleware_1.optionalAuthenticate, payment_controller_1.createPayLio);
// GET /api/v1/payments/paylio/:id/status — check PayLio payment status
router.get('/paylio/:id/status', auth_middleware_1.optionalAuthenticate, payment_controller_1.getPayLioPaymentStatus);
// POST /api/v1/payments/webhook/paylio — PayLio webhook
router.post('/webhook/paylio', payment_controller_1.processPayLioWebhook);
// ── Escrow Routes ───────────────────────────────────────────────────────────
// POST /api/v1/payments/escrow/create — create escrow
router.post('/escrow/create', auth_middleware_1.authenticate, payment_controller_1.createEscrow);
// GET /api/v1/payments/escrow/:id — get escrow details
router.get('/escrow/:id', auth_middleware_1.authenticate, payment_controller_1.getEscrowById);
// POST /api/v1/payments/escrow/:id/release — release escrow
router.post('/escrow/:id/release', auth_middleware_1.authenticate, payment_controller_1.releaseEscrow);
// POST /api/v1/payments/escrow/:id/refund — refund escrow
router.post('/escrow/:id/refund', auth_middleware_1.authenticate, payment_controller_1.refundEscrow);
// ── Webhook Routes ──────────────────────────────────────────────────────────
// POST /api/v1/payments/webhook/btcpay — BTCPay webhook
router.post('/webhook/btcpay', payment_controller_1.processBTCPayWebhook);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map