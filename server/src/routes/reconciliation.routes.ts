import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth.middleware';
import { reconcileIncomingPayment, resolveQueuedMatch, ReconciliationStatus } from '../services/auto-reconciliation.service';
import { fileInvoiceDispute, runFailureOwnership } from '../services/failure-ownership.service';
import { getMoneyFlow } from '../services/money-flow.service';
import { isRailId, RailId } from '../services/rail-router.service';
import { handlePaymentFailed, type FailedPayment } from '../services/payment-retry.service';
import { verifySolanaPayment, type ObservedTransfer } from '../services/solana-payment-verification.service';
import { paypalService } from '../services/paypal.service';

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
 * HMAC-SHA256 hex over the raw body, compared in constant time. Used by Square
 * and SafePay, which sign the raw request bytes.
 *
 * PayPal does not use this scheme and never did — see the paypal branch in
 * verifyRailSignature, which delegates to PayPal's own verification endpoint.
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
async function verifyRailSignature(
  rail: RailId,
  req: Request,
  opts: { failureEvent?: boolean } = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
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
    // PayPal has no shared-secret HMAC. The signature is certificate-based and
    // can only be checked against PayPal's verify-webhook-signature endpoint
    // using the dashboard webhook id, so this delegates to paypalService.
    //
    // This used to compare an HMAC of the raw body against PAYPAL_WEBHOOK_SECRET,
    // which is Square's scheme. No such PayPal secret exists, so the check could
    // never succeed: PayPal payments were collected and then never reconciled.
    // verifyWebhook() returns false rather than throwing, so a PayPal outage
    // does not turn into a retry storm against us.
    const verified = await paypalService.verifyWebhook(
      req.headers as Record<string, string>,
      rawBody,
    );
    if (!verified) return { ok: false, reason: 'invalid or unverifiable PayPal signature' };
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
    // Solana has no shared secret to HMAC against: there is no second party,
    // the payment IS a transaction on a public ledger. Authentication is
    // therefore replaced by verification — and verification has to be real.
    //
    // This used to be a base58 shape test, which proved nothing, and a comment
    // beside it claiming the amount was confirmed on-chain when it was not.
    // The endpoint settled any invoice named in the body for any amount, given
    // a string of the right length.
    //
    // What is checked now: the transaction exists, it did not fail, and it
    // moved the claimed amount of an accepted token. The recipient check is
    // layered on by the caller, which knows which business it belongs to.
    const signature = String(req.body?.signature ?? req.body?.transactionId ?? '');
    if (!signature) {
      return { ok: false, reason: 'missing Solana transaction signature' };
    }
    // A `payment.failed` report describes a transaction that legitimately has
    // `meta.err` set, so verifying it against the settlement rules would reject
    // every real decline and the retry would never fire. Existence is still
    // checked: a forged failure spends one of the client's retries, and a
    // budget burned by invention leaves the real payment no second chance.
    //
    // Detected BEFORE verification rather than after, because the verification
    // itself is what distinguishes the two cases.
    const isFailure = opts.failureEvent === true;
    const claimed = Number(req.body?.amount ?? req.body?.lamports ?? NaN);
    const result = await verifySolanaPayment({
      signature,
      claimedAmount: isFailure || !Number.isFinite(claimed) ? null : claimed,
      requireSuccess: !isFailure,
    });
    if (!result.ok) {
      logger.warn(`[ReconcileWebhook:solana] Rejected payment: ${result.reason}`);
      return { ok: false, reason: result.reason };
    }

    // Nothing transferred in a failure, so there is no destination to check.
    const destination = isFailure
      ? ({ ok: true } as const)
      : await solanaDestinationIsRegistered(
          typeof req.body?.businessId === 'string' ? req.body.businessId : null,
          result.transfers,
        );
    if (!destination.ok) {
      logger.warn(`[ReconcileWebhook:solana] Rejected payment: ${destination.reason}`);
      return { ok: false, reason: destination.reason };
    }

    return { ok: true };
  }

  // Bank transfers arrive by manual confirmation, not by callback. They are
  // authenticated like any other write instead.
  return { ok: false, reason: 'bank payments must be submitted through the authenticated endpoint' };
}

/**
 * Did this payment land at a wallet the business actually collects on?
 *
 * ─── WHY THIS IS A SEPARATE LAYER ──────────────────────────────────────────
 * On-chain verification above answers "is this a real transfer of the right
 * amount". It does not answer "was it a transfer to US", and the difference is
 * the whole attack: pointing the endpoint at a real, successful transaction
 * that paid somebody else settles the invoice perfectly.
 *
 * Existence plus success is not proof of settlement. Only the destination is.
 *
 * The `businessId` in the body is attacker-controlled, which does not weaken
 * this: naming a business makes the check STRICTER, because the transfer then
 * has to arrive at that business's registered wallet. There is no business
 * whose wallet the caller can choose that they could not simply have paid.
 */
async function solanaDestinationIsRegistered(
  businessId: string | null,
  transfers: ObservedTransfer[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!businessId) {
    // Cannot be checked, and the caller must know that rather than assume it
    // was. Reconciliation still requires the amount to match an open invoice,
    // so this is a gap rather than an open door — but it is a gap.
    logger.warn(
      '[ReconcileWebhook:solana] Payment carried no businessId, so the destination could not be checked against a registered wallet.',
    );
    return { ok: true };
  }

  const targets = await prisma.businessPaymentMethod.findMany({
    where: { businessId, railId: 'solana' },
    select: { target: true },
  });

  if (targets.length === 0) {
    return { ok: false, reason: `business ${businessId} has no registered Solana payment method` };
  }

  const expected = new Set(targets.map((t) => t.target));
  const landed = transfers.map((t) => t.destination).filter(Boolean);

  if (!landed.some((d) => expected.has(d))) {
    return {
      ok: false,
      reason: `payment landed at ${landed.join(', ') || 'an unknown address'}, which is not a registered destination for this business`,
    };
  }

  return { ok: true };
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

/**
 * Reduce a rail's FAILURE payload to what retry needs.
 *
 * Separate from `normaliseBody` because a failure and a success disagree about
 * almost everything: a failure has no amount worth trusting (the charge may
 * never have been attempted), no settled date, and a reason. It does have a
 * payment reference, and that is the field everything else hangs off.
 *
 * Returns undefined rather than guessing when there is no reference, because a
 * retry keyed on an absent reference would create a fresh claim for every
 * redelivery — which is the double-retry this whole path is guarded against.
 */
function normaliseFailure(rail: RailId, body: Record<string, unknown>): FailedPayment | undefined {
  const asRecord = body as Record<string, unknown>;

  // Square wraps in `payment`, everything else is flatter.
  const squarePayment = asRecord.payment as Record<string, unknown> | undefined;
  const detail = squarePayment as Record<string, unknown> | undefined;

  const reference =
    (typeof detail?.id === 'string' && detail.id) ||
    (typeof asRecord.paymentId === 'string' && asRecord.paymentId) ||
    (typeof asRecord.orderId === 'string' && asRecord.orderId) ||
    (typeof asRecord.transactionId === 'string' && asRecord.transactionId) ||
    (typeof asRecord.signature === 'string' && asRecord.signature) ||
    (typeof asRecord.id === 'string' && asRecord.id) ||
    '';

  if (!reference) return undefined;

  const squareMoney = detail?.amount_money as Record<string, unknown> | undefined;
  const squareMoneyAlt = detail?.amountMoney as Record<string, unknown> | undefined;
  const squareCurrency = squareMoney?.currency ?? squareMoneyAlt?.currency;

  // The amount is best-effort. A declined charge may report zero, and the retry
  // path only uses it to locate an invoice — which it will not do on a guess,
  // because resolveInvoice requires a single exact match.
  const rawAmount = squareMoney?.amount ?? squareMoneyAlt?.amount ?? asRecord.amount;
  const amount = rail === 'square' && rawAmount != null ? Number(rawAmount) / 100 : Number(rawAmount ?? 0);

  const error = (detail?.error ?? asRecord.error ?? asRecord.failure ?? asRecord.reason) as
    | Record<string, unknown>
    | string
    | undefined;
  const reason =
    typeof error === 'string'
      ? error
      : typeof error?.message === 'string'
        ? error.message
        : typeof error?.code === 'string'
          ? error.code
          : typeof asRecord.failureReason === 'string'
            ? asRecord.failureReason
            : undefined;

  return {
    paymentRef: `${rail}:${reference}`,
    rail,
    amount: Number.isFinite(amount) ? amount : 0,
    clientId:
      (typeof detail?.reference_id === 'string' && detail.reference_id) ||
      (typeof asRecord.clientId === 'string' && asRecord.clientId) ||
      undefined,
    invoiceId: typeof asRecord.invoiceId === 'string' ? asRecord.invoiceId : undefined,
    businessId: typeof asRecord.businessId === 'string' ? asRecord.businessId : undefined,
    currency:
      (typeof asRecord.currency === 'string' && asRecord.currency) ||
      (typeof squareCurrency === 'string' ? squareCurrency : undefined),
    reason,
  };
}

/**
 * Does this payload describe a failure?
 *
 * Checked before `normaliseBody` rather than after: the two disagree about
 * which payloads they recognise, and a Square `payment.failed` still carries
 * the same `id` and `amount_money` as the completed payment, so the success
 * normaliser would happily read a declined card as money received. Testing
 * intent first is what keeps a failure from being reconciled as a payment.
 *
 * Matched on the processor's own event names rather than on the shape of the
 * body, because the shape is identical between the two.
 */
function isFailureEvent(body: Record<string, unknown>): boolean {
  const type = String(body.type ?? body.event ?? body.event_type ?? body.eventType ?? '').toLowerCase();
  if (!type) return false;
  if (type.includes('fail') || type.includes('declin') || type.includes('cancel') || type.includes('expire')) {
    return true;
  }
  // PayPal puts the outcome on the resource rather than the event name.
  const resource = body.resource as Record<string, unknown> | undefined;
  const status = String(resource?.status ?? '').toLowerCase();
  return status === 'failed' || status === 'declined';
}

router.post('/webhook/:rail', async (req, res) => {
  const railParam = String(req.params.rail ?? '').toLowerCase();

  if (!isRailId(railParam)) {
    return res.status(400).json({ error: `Unknown rail: ${railParam}` });
  }
  const rail: RailId = railParam;

  try {

    if (rail === 'bank') {
      return res.status(400).json({ error: 'Bank transfers are confirmed manually, not by webhook.' });
    }

    // Computed before verification, because for Solana the verification is
    // what distinguishes a failure report from a payment claim.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const failureEvent = isFailureEvent(body);

    const verification = await verifyRailSignature(rail, req, { failureEvent });
    if (!verification.ok) {
      logger.warn(`[ReconcileWebhook:${rail}] Rejected webhook: ${verification.reason}`);
      return res.status(401).json({ error: verification.reason });
    }

    // ── Failure branch ───────────────────────────────────────────────────────
    // Before reconciliation, and never after: a declined payment must not be
    // able to reach `reconcileIncomingPayment`, which marks invoices paid.
    // Handled here so the existing endpoint serves both outcomes rather than
    // adding a second one to keep in sync.
    if (failureEvent) {
      const failure = normaliseFailure(rail, (req.body ?? {}) as Record<string, unknown>);
      if (!failure) {
        logger.info(`[ReconcileWebhook:${rail}] Failure payload had no usable reference; ignored.`);
        return res.status(200).json({ received: true, retried: false, reason: 'failure payload had no reference' });
      }

      const outcome = await handlePaymentFailed(failure);
      logger.info(`[ReconcileWebhook:${rail}] payment.failed ${failure.paymentRef} → ${outcome.action}.`);
      return res.status(200).json({
        received: true,
        action: outcome.action,
        retried: outcome.action === 'retried',
        duplicate: outcome.action === 'duplicate',
        retryCount: 'retryCount' in outcome ? outcome.retryCount : undefined,
        toRail: outcome.action === 'retried' ? outcome.toRail : undefined,
        reasoning: 'reasoning' in outcome ? outcome.reasoning : undefined,
      });
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

// ── Failure ownership ───────────────────────────────────────────────────────

/**
 * POST /api/v1/reconciliation/:invoiceId/dispute
 *
 * Body: { reason, evidence }
 *
 * Opens a dispute case in Pabandi's existing dispute layer and holds any
 * escrow against the invoice until it resolves. Idempotent: a second call for
 * the same invoice returns the existing case rather than filing a duplicate.
 */
router.post('/:invoiceId/dispute', authenticate, async (req: Request, res: Response) => {
  try {
    const invoiceId = String(req.params.invoiceId ?? '');
    const { reason, evidence } = req.body ?? {};

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required' });
    }
    if (evidence !== undefined && !Array.isArray(evidence)) {
      return res.status(400).json({ error: 'evidence must be an array of URLs' });
    }

    const outcome = await fileInvoiceDispute({
      invoiceId,
      reason: reason.trim(),
      evidence: (evidence as string[] | undefined) ?? [],
      filedByUserId: req.user?.id,
    });

    return res.status(201).json({ success: true, data: outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`[ReconcileDispute] failed: ${message}`);
    if (message === 'Invoice not found') {
      return res.status(404).json({ error: message });
    }
    return res.status(500).json({ error: 'Failed to open dispute' });
  }
});

/**
 * GET /api/v1/reconciliation/money-flow
 * The ContactOS "Money Flow" tab: expected incoming, received this week,
 * outstanding, per-rail volume and projected fees, and currency exposure.
 * Derived live from invoices and reconciliation matches — no stored aggregate.
 */
router.get('/money-flow', authenticate, async (req: Request, res: Response) => {
  try {
    const businessId = req.query.businessId ? String(req.query.businessId) : req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }
    const summary = await getMoneyFlow(String(businessId));
    return res.json({ success: true, data: summary });
  } catch (err) {
    logger.error(`[MoneyFlow] failed: ${err}`);
    return res.status(500).json({ error: 'Failed to load money flow' });
  }
});

/**
 * GET /api/v1/reconciliation/:invoiceId/failure-ownership
 * What the failure flow currently thinks about this invoice.
 */
router.get('/:invoiceId/failure-ownership', authenticate, async (req: Request, res: Response) => {
  try {
    const outcome = await runFailureOwnership(String(req.params.invoiceId), { notify: false });
    return res.json({ success: true, data: outcome });
  } catch (err) {
    logger.error(`[ReconcileFailureOwnership] failed: ${err}`);
    return res.status(500).json({ error: 'Failed to evaluate failure ownership' });
  }
});

/** POST /api/v1/reconciliation/:invoiceId/failure-ownership — run it now. */
router.post('/:invoiceId/failure-ownership', authenticate, async (req: Request, res: Response) => {
  try {
    const outcome = await runFailureOwnership(String(req.params.invoiceId), { notify: true });
    return res.json({ success: true, data: outcome });
  } catch (err) {
    logger.error(`[ReconcileFailureOwnership] failed: ${err}`);
    return res.status(500).json({ error: 'Failed to run failure ownership' });
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
