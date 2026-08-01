import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { paymentReconciliationService } from '../services/payment-reconciliation.service';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// Reconcile a single payment by ID
router.post('/payments/:id/reconcile', authorize('ADMIN'), async (req, res, next) => {
  try {
    const result = await paymentReconciliationService.reconcilePayment(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Reconciliation error:', error);
    next(error);
  }
});

// Bulk reconcile stale pending/processing payments
router.post('/payments/reconcile', authorize('ADMIN'), async (req, res, next) => {
  try {
    const maxAgeMs = req.body?.maxAgeMs;
    const limit = req.body?.limit;
    const results = await paymentReconciliationService.reconcileStalePayments({
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
  } catch (error) {
    logger.error('Bulk reconciliation error:', error);
    next(error);
  }
});

export default router;
