import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
import { handleSquareWebhook } from '../controllers/squareCheckout.controller';
import { webhookVerifierMiddleware } from '../utils/webhookVerifier';

const router = Router();

// Zod schema for payment creation
const CreatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('USD'),
  reference: z.string().max(100).optional(),
  payer: z.record(z.any()).optional(),
  payee: z.record(z.any()).optional(),
  preferredRail: z.string().default('auto'),
  requireSharia: z.boolean().default(false),
  isAgent: z.boolean().default(false),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  metadata: z.record(z.any()).optional(),
  dryRun: z.boolean().optional(),
});

// Square Webhook for Cross-Border & card payments
router.post('/square-webhook', handleSquareWebhook);

// ── Payment Routes ──────────────────────────────────────────────────────────

// POST /api/v1/payments — Unified Open Payment Orchestration endpoint (Mode A)
router.post('/', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const parseResult = CreatePaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

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
      metadata,
      dryRun,
    } = parseResult.data;

    // Dry-run mode: validate everything but don't persist
    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: 'Dry run completed - no payment created',
        data: {
          wouldCreatePayment: true,
          amount,
          currency,
          preferredRail,
          estimatedFees: 0, // Would be calculated by payment router
        },
      });
    }

    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    const payment = await paymentOrchestrator.createPayment({
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      reference: String(reference),
      payer,
      payee,
      preferredRail: preferredRail as any,
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

// GET /api/v1/payments/:id/status — check payment status (owner/admin only)
router.get('/:id/status', authenticate, getPaymentStatus);

// POST /api/v1/payments/:id/verify — verify payment on-chain (owner/admin only)
router.post('/:id/verify', authenticate, verifyPayment);

// POST /api/v1/payments/manual-approve — Coordinator/Admin manual receipt approval & ledger release
router.post('/manual-approve', authenticate, authorize('ADMIN', 'COORDINATOR'), manualApprovePayment);

// GET /api/v1/payments/manual-review-queue — Coordinator/Admin review queue for low-confidence receipts
router.get('/manual-review-queue', authenticate, authorize('ADMIN', 'COORDINATOR'), getManualReviewQueue);

// GET /api/v1/payments/:id — get payment details (owner/admin only)
router.get('/:id', authenticate, getPaymentById);

// POST /api/v1/payments/paylio/create — create PayLio fiat payment
router.post('/paylio/create', optionalAuthenticate, createPayLio);

// GET /api/v1/payments/paylio/:id/status — check PayLio payment status (owner/admin only)
router.get('/paylio/:id/status', authenticate, getPayLioPaymentStatus);

// POST /api/v1/payments/webhook/paylio — PayLio webhook.
// Signature check is mandatory: an unset secret rejects the event rather than
// letting an anonymous caller create escrow. See .env.example.
router.post('/webhook/paylio', webhookVerifierMiddleware('paylio'), processPayLioWebhook);

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

// POST /api/v1/payments/webhook/btcpay — BTCPay webhook.
// HMAC over the raw body with BTCPAY_WEBHOOK_SECRET, fail closed when unset.
router.post('/webhook/btcpay', webhookVerifierMiddleware('btcpay'), processBTCPayWebhook);

export default router;
