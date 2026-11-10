import { Router, Request, Response } from 'express';
import { paymentOrchestrator } from '../services/payment-orchestration/orchestrator.service';
import { connectorRegistry, PaymentRailId } from '../services/payment-orchestration/connectors';
import { ledgerService } from '../services/payment-orchestration/ledger.service';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { encodePaymentRequired, buildPaymentRequired } from '../services/x402.service';
import { logger } from '../utils/logger';

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MODE A: PABANDI AS THE ORCHESTRATOR (ON TOP)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/payments (or /api/v1/orchestrator/payments)
 * Unified payment initiation endpoint.
 * Dispatches to the optimal rail (Solana USDC, SBP Raast, Card, Mobile Wallet)
 * based on cost, speed, Sharia compliance, and geography.
 */
router.post('/payments', optionalAuthenticate, async (req: Request, res: Response) => {
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
    logger.error('[OrchestrationRoutes] POST /payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment orchestration failed',
    });
  }
});

/**
 * GET /api/v1/payments/:id
 * Retrieve payment status, routing decision, and lifecycle history.
 */
router.get('/payments/:id', (req: Request, res: Response) => {
  const payment = paymentOrchestrator.getPayment(req.params.id);
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: `Payment ${req.params.id} not found`,
    });
  }

  const ledgerTx = payment.ledgerJournalId 
    ? ledgerService.getTransaction(payment.paymentId) 
    : undefined;

  res.json({
    success: true,
    data: {
      ...payment,
      ledger: ledgerTx,
    },
  });
});

/**
 * POST /api/v1/payments/:id/simulate-complete
 * For sandbox / automated testing: Simulates incoming rail settlement.
 */
router.post('/payments/:id/simulate-complete', async (req: Request, res: Response) => {
  const payment = await paymentOrchestrator.updateStatus(req.params.id, 'SUCCEEDED', {
    simulatedOn: new Date().toISOString(),
    txHash: `sim_${Date.now()}`,
  });

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Payment not found' });
  }

  res.json({
    success: true,
    message: `Payment ${payment.paymentId} transitioned to SUCCEEDED`,
    data: payment,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MODE B: PABANDI AS THE CONNECTOR (BENEATH / "BRING YOUR OWN PROCESSOR")
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/connectors/:rail/payments
 * Direct rail endpoint. Allows partners with their own routing logic
 * to utilize specific Pabandi connectors (e.g. Raast, Solana USDC, JazzCash).
 */
router.post('/connectors/:rail/payments', async (req: Request, res: Response) => {
  try {
    const railId = req.params.rail.toLowerCase() as PaymentRailId;
    const connector = connectorRegistry.get(railId);

    if (!connector) {
      return res.status(400).json({
        success: false,
        error: `Unknown rail '${req.params.rail}'. Supported rails: solana, raast, stripe, jazzcash`,
      });
    }

    const { amount, currency = 'USD', reference = `direct_${Date.now()}`, payer, payee, metadata } = req.body;
    const paymentId = `direct_${railId}_${Date.now()}`;

    const response = await connector.initiatePayment({
      paymentId,
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      reference,
      payer,
      payee,
      metadata,
    });

    res.status(201).json({
      success: true,
      rail: railId,
      data: response,
    });
  } catch (err: any) {
    logger.error(`[OrchestrationRoutes] Connector ${req.params.rail} direct error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/connectors/:rail/status/:ref
 * Query direct connector transaction status.
 */
router.get('/connectors/:rail/status/:ref', async (req: Request, res: Response) => {
  const railId = req.params.rail.toLowerCase() as PaymentRailId;
  const connector = connectorRegistry.get(railId);
  if (!connector) {
    return res.status(400).json({ success: false, error: 'Invalid rail' });
  }

  const status = await connector.checkStatus(req.params.ref);
  res.json({ success: true, data: status });
});

/**
 * POST /api/v1/connectors/:rail/webhook
 * Inbound webhook listener for individual rails.
 */
router.post('/connectors/:rail/webhook', async (req: Request, res: Response) => {
  const railId = req.params.rail.toLowerCase() as PaymentRailId;
  const connector = connectorRegistry.get(railId);
  if (!connector) {
    return res.status(400).json({ success: false, error: 'Invalid rail' });
  }

  const result = await connector.processWebhook(req.body, req.headers as Record<string, string>);
  
  // If a paymentId was extracted and updated to succeeded, reflect in orchestrator
  if (result.paymentId && result.newStatus) {
    await paymentOrchestrator.updateStatus(result.paymentId, result.newStatus, { txHash: result.txHash });
  }

  res.json({ success: true, result });
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTLEMENT & DOUBLE-ENTRY LEDGER RECONCILIATION
// ══════════════════════════════════════════════════════════════════════════════

router.get('/ledger/transactions/:paymentId', (req: Request, res: Response) => {
  const tx = ledgerService.getTransaction(req.params.paymentId);
  if (!tx) {
    return res.status(404).json({ success: false, error: 'Ledger journal not found for payment' });
  }
  res.json({ success: true, data: tx });
});

router.get('/ledger/reconciliation', (_req: Request, res: Response) => {
  const summary = ledgerService.getReconciliationSummary();
  res.json({ success: true, data: summary });
});

// ══════════════════════════════════════════════════════════════════════════════
// HTTP 402: MACHINE PAYMENTS PROTOCOL (MPP) & x402 FOR AGENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/agent/premium-resource
 * Demonstrates the x402 HTTP 402 Payment Required pattern for autonomous agents.
 * 
 * If caller does not present a valid payment proof (X-Pabandi-Payment-Proof or
 * PAYMENT-SIGNATURE header), responds with HTTP 402 and the exact Solana USDC
 * PaymentRequirements.
 */
router.get('/agent/premium-resource', (req: Request, res: Response) => {
  const paymentProof = req.headers['payment-signature'] || req.headers['x-pabandi-payment-proof'];

  if (!paymentProof) {
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const priceUsdc = 0.05; // 5 cents USDC for high-tier intelligence report

    const paymentRequired = buildPaymentRequired({
      resource: resourceUrl,
      amountUsdc: priceUsdc,
      description: 'Pabandi Verified Real-Time Cross-Rail Liquidity & Settlement Feed',
      extensions: {
        mppVersion: '1.0',
        standards: ['x402-v2', 'SolanaPay', 'OpenPayments'],
      },
    });

    const encodedHeader = encodePaymentRequired(paymentRequired);

    res.set({
      'PAYMENT-REQUIRED': encodedHeader,
      'WWW-Authenticate': `X-Pabandi-Payment-Required amount="${priceUsdc}", currency="USDC", network="solana"`,
    });

    return res.status(402).json({
      status: 402,
      error: 'Payment Required',
      message: 'This resource requires an autonomous agent micropayment of 0.05 USDC.',
      paymentDetails: paymentRequired,
      instructions: 'Submit payment to the payTo address via Solana Pay, then re-issue request with the PAYMENT-SIGNATURE or X-Pabandi-Payment-Proof header.',
    });
  }

  // Payment proof supplied — grant access to the resource
  res.json({
    success: true,
    data: {
      resource: 'Pabandi Premium Liquidity & Trust Telemetry',
      timestamp: new Date().toISOString(),
      networkHealth: {
        solanaAnchor: 'HEALTHY (0.4s finality)',
        sbpRaast: 'ONLINE (Instant clearing)',
        jazzCashP2M: 'ONLINE',
      },
      verifiedTrustScoreAverage: 788,
      authenticatedProof: paymentProof,
    },
  });
});

export default router;

