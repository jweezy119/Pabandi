import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
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
} from '../controllers/payment.controller';

const router = Router();

// ── Payment Routes ──────────────────────────────────────────────────────────

// POST /api/v1/payments/create — create payment request (USDC/BTCPay/Manual)
router.post('/create', optionalAuthenticate, createPaymentRequest);

// GET /api/v1/payments/:id/status — check payment status
router.get('/:id/status', optionalAuthenticate, getPaymentStatus);

// POST /api/v1/payments/:id/verify — verify payment on-chain
router.post('/:id/verify', optionalAuthenticate, verifyPayment);

// GET /api/v1/payments/:id — get payment details
router.get('/:id', optionalAuthenticate, getPaymentById);

// ── Escrow Routes ───────────────────────────────────────────────────────────

// POST /api/v1/payments/escrow/create — create escrow
router.post('/escrow/create', authenticate, createEscrow);

// GET /api/v1/payments/escrow/:id — get escrow details
router.get('/escrow/:id', authenticate, getEscrowById);

// POST /api/v1/payments/escrow/:id/release — release escrow
router.post('/escrow/:id/release', authenticate, releaseEscrow);

// POST /api/v1/payments/escrow/:id/refund — refund escrow
router.post('/escrow/:id/refund', authenticate, refundEscrow);

// ── Webhook Routes ──────────────────────────────────────────────────────────

// POST /api/v1/payments/webhook/btcpay — BTCPay webhook
router.post('/webhook/btcpay', processBTCPayWebhook);

export default router;
