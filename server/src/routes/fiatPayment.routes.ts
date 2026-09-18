import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import {
  createFiatPaymentRequest,
  getFiatPaymentStatusController,
  confirmFiatPaymentController,
  rejectFiatPaymentController,
  cancelFiatPaymentController,
  markFiatPaymentSentController,
  getFiatMethods,
  listPendingFiatPaymentsController,
} from '../controllers/fiatPayment.controller';

const router = Router();

// GET /api/v1/fiat/methods — list available fiat payment methods
router.get('/methods', getFiatMethods);

// POST /api/v1/fiat/create — create a fiat payment request
router.post('/create', optionalAuthenticate, createFiatPaymentRequest);

// GET /api/v1/fiat/:reference/status — check payment status
router.get('/:reference/status', optionalAuthenticate, getFiatPaymentStatusController);

// POST /api/v1/fiat/:reference/sent — payer marks payment as sent
router.post('/:reference/sent', authenticate, markFiatPaymentSentController);

// POST /api/v1/fiat/:reference/confirm — business confirms receipt
router.post('/:reference/confirm', authenticate, confirmFiatPaymentController);

// POST /api/v1/fiat/:reference/reject — business rejects payment
router.post('/:reference/reject', authenticate, rejectFiatPaymentController);

// POST /api/v1/fiat/:reference/cancel — payer cancels payment
router.post('/:reference/cancel', authenticate, cancelFiatPaymentController);

// GET /api/v1/fiat/pending — list pending payments for a business
router.get('/pending', authenticate, listPendingFiatPaymentsController);

export default router;
