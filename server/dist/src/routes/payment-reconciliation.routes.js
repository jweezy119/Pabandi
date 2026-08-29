"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const payment_reconciliation_service_1 = require("../services/payment-reconciliation.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Reconcile a single payment by ID
router.post('/payments/:id/reconcile', (0, auth_middleware_1.authorize)('ADMIN'), async (req, res, next) => {
    try {
        const result = await payment_reconciliation_service_1.paymentReconciliationService.reconcilePayment(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('Reconciliation error:', error);
        next(error);
    }
});
// Bulk reconcile stale pending/processing payments
router.post('/payments/reconcile', (0, auth_middleware_1.authorize)('ADMIN'), async (req, res, next) => {
    try {
        const maxAgeMs = req.body?.maxAgeMs;
        const limit = req.body?.limit;
        const results = await payment_reconciliation_service_1.paymentReconciliationService.reconcileStalePayments({
            maxAgeMs,
            limit,
        });
        res.json({
            success: true,
            data: {
                processed: results.length,
                results,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Bulk reconciliation error:', error);
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=payment-reconciliation.routes.js.map