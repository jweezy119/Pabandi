import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth.middleware';
import { reconcileIncomingPayment, resolveQueuedMatch, ReconciliationStatus } from '../services/auto-reconciliation.service';
import { isRailId, RailId } from '../services/rail-router.service';

/**
 * Reconciliation routes.
 *
 * WHY A NEW RAIL WEBHOOK MOUNT
 * Of the five wired rails, only Square had an inbound webhook endpoint. PayPal
 * and SafePay have signature verifiers in their services that nothing ever
 * called; Solana and bank had none at all. Without an endpoint, a payment on
 * those rails can never be reconciled, so the "auto-reconcile every rail"
 * requirement has nowhere to run. This mount gives them one.
 *
 * It is a single shared handler because reconciliation is rail-agnostic: the
 * rails differ only in how the body is shaped and how the signature is
 * computed, and both of those are per-rail helpers below.
 *
 * SCOPE: square, solana, paypal, safepay, bank. No new rails.
 */

const router = Router();

// ── Signature verification ──────────────────────────────────────────────────

/**
 * HMAC-SHA256 hex over the raw body, compared in constant time. Used by
 * PayPal and SafePay, both of which sign the raw request bytes.
 */
function verifyHmacHex(rawBody: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify the rail's signature, or refuse. A rail webhook that cannot be
 * verified is an unauthenticated "mark this invoice paid" endpoint, so this
 * fails closed rather than waving unverified requests through.
 */
function verifyRailSignature(rail: RailId, req: Request): { ok: true } | { ok: false; reason: string } {
  const rawBody = typeof (req as Request & { rawBody?: string }).rawBody === 'string'
    ? (req as Request & { rawBody?: string }).rawBody as string
    : JSON.stringify(req.body ?? {});

  if (rail === 'square') {
    const secret = process.env.SQUARE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: 'SQUARE_WEBHOOK_SECRET is not configured' };
    const signature = req.headers['x-square-hmacsha256-signature'] as string | undefined;
    if (!verifyHmacHex(rawBody, signature, secret)) return { ok: false, reason: 'invalid Square signature' };
    return { ok: true };
  }

  if (rail === 'paypal') {
    const secret = process.env.PAYPAL_WEBHOOK_SECRET;
    if (!secret) return { ok: false, reason: 'PAYPAL_WEBHOOK_SECRET is not configured' };
    const signature = req.headers['paypal-transmission-sig'] as string | undefined;
    if (!verifyHmacHex(rawBody, signature, secret)) return { ok: false, reason: 'invalid PayPal signature' };
    return { ok: true };
  }

  if (rail === 'safepay') {
    const secret = process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY;
    if (!secret) return { ok: false, reason: 'SAFEPAY_WEBHOOK_SECRET is not configured' };
    const signature = (req.headers['x-sfpy-signature'] || req.headers['x-safepay-signature']) as string | undefined;
    if (!verifyHmacHex(rawBody, signature, secret)) return { ok: false, reason: 'invalid SafePay signature' };
    return { ok: true };
  }

  if (rail === 'solana') {
    // Solana has no shared secret. The signature of record is the on-chain
    // transaction, so the reference must look like a real signature and the
    // amount must be confirmed against the chain before we trust it.
    const ref = String(req.body?.signature ?? req.body?.transactionId ?? '');
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(ref)) {
      return { ok: false, reason: 'missing or malformed Solana transaction signature' };
    }
    return { ok: true };
  }

  // Bank transfers arrive by manual confirmation, not by callback. They are
  // authenticated like any other write instead.
  return { ok: false, reason: 'bank payments must be submitted through the authenticated endpoint' };
}

// ── Body normalisation per rail ─────────────────────────────────────────────

interface NormalisedPayment {
  paymentRef: string;
  amount: number;
  clientId?: string;
  currency?: string;
  paidAt?: Date;
}

/**
 * Reduce each rail's payload to the four fields reconciliation needs. Every
 * branch returns undefined when the required fields are absent, so a payload
 * we do not understand becomes a logged no-op rather than a guess.
 */
function normaliseBody(rail: RailId, body: Record<string, unknown>): NormalisedPayment | undefined {
  const asRecord = body as Record<string, string | number | Record<string, unknown> | undefined>;

  if (rail === 'square') {
    const payment = (asRecord.payment ?? asRecord.data) as Record<string, string | number | Record<string, unknown>> | undefined;
    const id = payment?.id as string | undefined;
    const money = payment?.amount_money as Record<string, string | number> | undefined
      ?? payment?.amountMoney as Record<string, string | number> | undefined;
    if (!id || !money?.amount) return undefined;
    return {
      paymentRef: `square:${id}`,
      amount: Number(money.amount) / 100,
      clientId: (payment?.reference_id as string) || undefined,
      currency: money.currency as string | undefined,
    };
  }

  if (rail === 'paypal') {
    const resource = asRecord.resource as Record<string, string | number | Record<string, unknown>> | undefined;
    const id = resource?.id as string | undefined;
    const amount = resource?.amount as Record<string, string | number> | undefined
      ?? resource?.amount as string | undefined;
    if (!id || amount == null) return undefined;
    const value = typeof amount === 'object' ? Number((amount as Record<string, string>).value) : Number(amount);
    if (!Number.isFinite(value)) return undefined;
    return {
      paymentRef: `paypal:${id}`,
      amount: value,
      clientId: (resource?.custom_id as string) || (resource?.invoice_number as string) || undefined,
      currency: (typeof amount === 'object' ? (amount as Record<string, string>).currency : undefined) ?? (resource?.currency_code as string),
      paidAt: resource?.create_time ? new Date(String(resource.create_time)) : undefined,
    };
  }

  if (rail === 'safepay') {
    const id = (asRecord.paymentId ?? asRecord.orderId ?? asRecord.transactionId) as string | undefined;
    const rawAmount = asRecord.amount as string | number | undefined;
    if (!id || rawAmount == null) return undefined;
    const value = Number(rawAmount);
    if (!Number.isFinite(value)) return undefined;
    return {
      paymentRef: `safepay:${id}`,
      amount: value,
      clientId: (asRecord.clientId as string) || undefined,
      currency: (asRecord.currency as string) || 'PKR',
    };
  }

  if (rail === 'solana') {
    const sig = (body.signature ?? body.transactionId) as string | undefined;
    const rawAmount = (body.amount ?? body.lamports) as string | number | undefined;
    if (!sig || rawAmount == null) return undefined;
    const value = Number(rawAmount);
    if (!Number.isFinite(value)) return undefined;
    return {
      paymentRef: `solana:${sig}`,
      amount: value,
      clientId: (body.clientId as string) || undefined,
      currency: (body.currency as string) || 'USDC',
    };
  }

  return undefined;
}

// ── Public webhook mount (no auth — the rail calls us) ──────────────────────

router.post('/webhook/:rail', async (req: Request, res: Response) => {
  const railParam = String(req.params.rail ?? '').toLowerCase();

  if (!isRailId(railParam)) {
    return res.status(400).json({ error: `Unknown rail: ${railParam}` });
  }
  const rail: RailId = railParam;

  try {

    if (rail === 'bank') {
      return res.status(400).json({ error: 'Bank transfers are confirmed manually, not by webhook.' });
    }

    const verification = verifyRailSignature(rail, req);
    if (!verification.ok) {
      logger.warn(`[ReconcileWebhook:${rail}] Rejected webhook: ${verification.reason}`);
      return res.status(401).json({ error: verification.reason });
    }

    const payment = normaliseBody(rail, (req.body ?? {}) as Record<string, unknown>);
    if (!payment) {
      // Not an error: rails send many event types we do not act on. Ack so
      // they stop retrying, and log so we can see what we are ignoring.
      logger.info(`[ReconcileWebhook:${rail}] Ignored unrecognised payload shape.`);
      return res.status(200).json({ received: true, reconciled: false, reason: 'unrecognised payload' });
    }

    const businessId = typeof req.body?.businessId === 'string' ? (req.body.businessId as string) : undefined;

    const outcome = await reconcileIncomingPayment({
      paymentRef: payment.paymentRef,
      rail,
      amount: payment.amount,
      clientId: payment.clientId,
      currency: payment.currency,
      paidAt: payment.paidAt,
      businessId,
    });

    return res.status(200).json({
      received: true,
      reconciled: !outcome.duplicate && outcome.status === 'matched',
      status: outcome.status,
      duplicate: outcome.duplicate,
      reasoning: outcome.reasoning,
      candidates: outcome.candidates,
    });
  } catch (err) {
    logger.error(`[ReconcileWebhook:${rail}] failed: ${err}`);
    return res.status(500).json({ error: 'Reconciliation failed' });
  }
});

// ── Authenticated bank-transfer confirmation ────────────────────────────────
// Bank has no callback and no HMAC. A signed-in business user confirming an
// inbound transfer is the whole authentication story, which is strictly
// stronger than a shared secret on a public endpoint.

router.post('/webhook/bank', authenticate, async (req: Request, res: Response) => {
  try {
    const { businessId, reference, amount, clientId, currency, paidAt } = req.body ?? {};
    if (!businessId || !reference || amount == null) {
      return res.status(400).json({ error: 'businessId, reference and amount are required' });
    }
    const value = Number(amount);
    if (!Number.isFinite(value)) {
      return res.status(400).json({ error: 'amount must be a number' });
    }

    const outcome = await reconcileIncomingPayment({
      paymentRef: `bank:${reference}`,
      rail: 'bank',
      amount: value,
      clientId: clientId || undefined,
      currency: currency || undefined,
      paidAt: paidAt ? new Date(String(paidAt)) : undefined,
      businessId: String(businessId),
    });

    return res.json({
      success: true,
      status: outcome.status,
      duplicate: outcome.duplicate,
      reasoning: outcome.reasoning,
      candidates: outcome.candidates,
    });
  } catch (err) {
    logger.error(`[ReconcileWebhook:bank] failed: ${err}`);
    return res.status(500).json({ error: 'Reconciliation failed' });
  }
});

// ── Review queue (authenticated) ────────────────────────────────────────────

/** GET /api/v1/reconciliation/queue — payments a human has to decide on. */
router.get('/queue', authenticate, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status ?? 'queued') as ReconciliationStatus;
    const businessId = req.query.businessId ? String(req.query.businessId) : undefined;

    const rows = await prisma.reconciliationMatch.findMany({
      where: {
        status,
        ...(businessId ? { invoice: { businessId } } : {}),
      },
      include: { invoice: { select: { number: true, businessId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        paymentRef: r.paymentRef,
        rail: r.rail,
        amount: r.amount.toString(),
        status: r.status,
        confidence: r.confidence,
        candidates: r.candidates,
        note: r.note,
        createdAt: r.createdAt,
        invoice: r.invoice,
      })),
    });
  } catch (err) {
    logger.error(`[ReconcileQueue] failed: ${err}`);
    return res.status(500).json({ error: 'Failed to load reconciliation queue' });
  }
});

/** POST /api/v1/reconciliation/queue/:id/resolve — a human picks the invoice. */
router.post('/queue/:id/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const { invoiceId, note } = req.body ?? {};
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId is required' });

    const outcome = await resolveQueuedMatch(String(req.params.id), String(invoiceId), note ? String(note) : undefined);
    return res.json({ success: true, data: outcome });
  } catch (err) {
    logger.error(`[ReconcileResolve] failed: ${err}`);
    return res.status(500).json({ error: 'Failed to resolve reconciliation match' });
  }
});

export default router;
