import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate, authorize } from '../middleware/auth.middleware';
import { requireIdempotency } from '../middleware/idempotency.middleware';
import { paymentRouter } from '../services/payment-router.service';
import { paymentOrchestrator } from '../services/payment-orchestration/orchestrator.service';
import { 
  createPaymentRequest, 
  getPaymentById, 
  getPaymentStatus,
  verifyPayment, 
  createEscrow, 
  releaseEscrow, 
  refundEscrow, 
  getEscrowById,
  processBTCPayWebhook,
  createPayLio,
  getPayLioPaymentStatus,
  processPayLioWebhook,
  manualApprovePayment,
  getManualReviewQueue,
} from '../controllers/payment.controller';

const router = Router();

// ── Payment Routes ──────────────────────────────────────────────────────────

// POST /api/v1/payments — Unified Open Payment Orchestration endpoint (Mode A)
router.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    const { 
      amount, 
      currency = 'USD', 
      reference = `ref_${Date.now()}`,
      payer, 
      payee, 
      preferredRail = 'auto', 
      requireSharia = false, 
      isAgent = false,
      webhookUrl, 
      metadata 
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be greater than 0.',
      });
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    const payment = await paymentOrchestrator.createPayment({
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      reference: String(reference),
      payer,
      payee,
      preferredRail,
      requireSharia: Boolean(requireSharia),
      isAgent: Boolean(isAgent),
      webhookUrl,
      metadata,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Payment orchestration failed',
    });
  }
});

// GET /api/v1/payments/recommend-rail — intelligent fee/speed comparison
router.get('/recommend-rail', (req: Request, res: Response) => {
  const amount = Number(req.query.amount) || 100;
  const currency = String(req.query.currency || 'USD');
  const clientCountry = String(req.query.country || '');
  const isAgent = req.query.isAgent === 'true';

  const recommendations = paymentRouter.recommendRails({
    amount,
    currency,
    clientCountry,
    isAgent,
  });

  res.json({
    success: true,
    data: recommendations,
  });
});

// POST /api/v1/payments/create — create payment request (USDC/BTCPay/Manual)
router.post('/create', requireIdempotency, optionalAuthenticate, createPaymentRequest);

// GET /api/v1/payments/:id/status — check payment status
router.get('/:id/status', optionalAuthenticate, getPaymentStatus);

// POST /api/v1/payments/:id/verify — verify payment on-chain
router.post('/:id/verify', optionalAuthenticate, verifyPayment);

// POST /api/v1/payments/manual-approve — Coordinator/Admin manual receipt approval & ledger release
router.post('/manual-approve', authenticate, authorize('ADMIN', 'COORDINATOR', 'BUSINESS_OWNER'), manualApprovePayment);

// GET /api/v1/payments/manual-review-queue — Coordinator/Admin review queue for low-confidence receipts
router.get('/manual-review-queue', authenticate, authorize('ADMIN', 'COORDINATOR', 'BUSINESS_OWNER'), getManualReviewQueue);

// GET /api/v1/payments/:id — get payment details
router.get('/:id', optionalAuthenticate, getPaymentById);

// POST /api/v1/payments/paylio/create — create PayLio fiat payment
router.post('/paylio/create', optionalAuthenticate, createPayLio);

// GET /api/v1/payments/paylio/:id/status — check PayLio payment status
router.get('/paylio/:id/status', optionalAuthenticate, getPayLioPaymentStatus);

// POST /api/v1/payments/webhook/paylio — PayLio webhook
router.post('/webhook/paylio', processPayLioWebhook);

// ── Escrow Routes ───────────────────────────────────────────────────────────

// POST /api/v1/payments/escrow/create — create escrow
router.post('/escrow/create', requireIdempotency, authenticate, createEscrow);

// GET /api/v1/payments/escrow/:id — get escrow details
router.get('/escrow/:id', authenticate, getEscrowById);

// POST /api/v1/payments/escrow/:id/release — release escrow
router.post('/escrow/:id/release', requireIdempotency, authenticate, releaseEscrow);

// POST /api/v1/payments/escrow/:id/refund — refund escrow
router.post('/escrow/:id/refund', requireIdempotency, authenticate, refundEscrow);

// ── Webhook Routes ──────────────────────────────────────────────────────────

// POST /api/v1/payments/webhook/btcpay — BTCPay webhook
router.post('/webhook/btcpay', processBTCPayWebhook);

export default router;
