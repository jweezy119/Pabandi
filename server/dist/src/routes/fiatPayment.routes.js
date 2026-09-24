"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const fiatPayment_controller_1 = require("../controllers/fiatPayment.controller");
const router = (0, express_1.Router)();
// GET /api/v1/fiat/methods — list available fiat payment methods
router.get('/methods', fiatPayment_controller_1.getFiatMethods);
// POST /api/v1/fiat/create — create a fiat payment request
router.post('/create', auth_middleware_1.optionalAuthenticate, fiatPayment_controller_1.createFiatPaymentRequest);
// GET /api/v1/fiat/:reference/status — check payment status
router.get('/:reference/status', auth_middleware_1.optionalAuthenticate, fiatPayment_controller_1.getFiatPaymentStatusController);
// POST /api/v1/fiat/:reference/sent — payer marks payment as sent
router.post('/:reference/sent', auth_middleware_1.authenticate, fiatPayment_controller_1.markFiatPaymentSentController);
// POST /api/v1/fiat/:reference/confirm — business confirms receipt
router.post('/:reference/confirm', auth_middleware_1.authenticate, fiatPayment_controller_1.confirmFiatPaymentController);
// POST /api/v1/fiat/:reference/reject — business rejects payment
router.post('/:reference/reject', auth_middleware_1.authenticate, fiatPayment_controller_1.rejectFiatPaymentController);
// POST /api/v1/fiat/:reference/cancel — payer cancels payment
router.post('/:reference/cancel', auth_middleware_1.authenticate, fiatPayment_controller_1.cancelFiatPaymentController);
// GET /api/v1/fiat/pending — list pending payments for a business
router.get('/pending', auth_middleware_1.authenticate, fiatPayment_controller_1.listPendingFiatPaymentsController);
exports.default = router;
//# sourceMappingURL=fiatPayment.routes.js.map