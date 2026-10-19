import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validateZod';
import { x402PaySchema } from '../schemas/agentic.schemas';
import engineService from '../services/engine.service';
import { verifyX402Payment, createX402PaymentRequirement, X402_PRICING } from '../services/x402.service';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

/**
 * x402 micropayments.
 *
 * ─── WHAT CHANGED AND WHY ───────────────────────────────────────────────────
 * This route did not exist. x402 existed as a service (verifyX402Payment,
 * createX402PaymentRequirement) and a pricing table, and was consumed by
 * exactly one caller: the MCP server's requireX402 gate. No HTTP route reached
 * it.
 *
 * The change Phase 4 asks for -- spend from a session rather than demanding a
 * wallet signature per micropayment -- is the reason to build it now. A caller
 * with an open PabandiSession spends against its limit and never signs again.
 *
 * Two paths, because they are genuinely different products:
 *
 *   1. `sessionId` present  -> debit the session. No signature, no provider
 *      call. This is the frictionless path and the reason the route exists.
 *   2. `sessionId` absent   -> classic x402. Requires an `x-payment` header
 *      proving payment of `amount`, verified against the facilitator. This is
 *      the per-request rail and is unchanged in shape from what x402.service
 *      already does for MCP.
 *
 * The session path is tried first and the x402 header path is the fallback, so
 * adding a session to a caller that already sends x-payment changes nothing for
 * them and saves them a signature.
 */

const router = Router();

const FAILURE_STATUS: Record<string, number> = {
  SESSION_NOT_FOUND: 404,
  SESSION_NOT_ACTIVE: 409,
  SESSION_EXPIRED: 410,
  LIMIT_EXCEEDED: 402,
  CONCURRENT_SPEND: 409,
  INVALID_AMOUNT: 400,
};

router.post('/pay', writeLimiter, validateBody(x402PaySchema), async (req: Request, res: Response) => {
  const { amount, description, recipientId, route, sessionId, idempotencyKey } = req.body as {
    amount: number;
    description?: string;
    recipientId?: string;
    route?: string;
    sessionId?: string;
    idempotencyKey?: string;
  };

  // ── PATH 1: SPEND FROM A SESSION ──────────────────────────────────────────
  if (sessionId) {
    const outcome = await engineService.executeTransaction({
      sessionId,
      actionType: 'invoice_pay',
      amount,
      payload: { description, recipientId, route, source: 'x402' },
      idempotencyKey,
    });

    if (!outcome.ok) {
      const status = FAILURE_STATUS[outcome.error.code] ?? 400;

      // 402 on an exhausted session is the one case worth a body an agent can
      // act on: it needs to know the tab is empty and how to open another.
      if (outcome.error.code === 'LIMIT_EXCEEDED') {
        return res.status(402).json({
          success: false,
          error: 'LIMIT_EXCEEDED',
          // message is on the error object already; spreading after it would
          // silently drop the explicit one.
          ...outcome.error,
          remedy: {
            action: 'open_new_session',
            endpoint: 'POST /api/v1/engine/session/open',
          },
        });
      }

      return res.status(status).json({ success: false, error: outcome.error.code, ...outcome.error });
    }

    return res.status(200).json({
      success: true,
      data: {
        method: 'session',
        // No transactionHash: nothing went on-chain. Saying `settled: true`
        // here would be a lie until Phase 4 settlement lands, so the field
        // exists and is false.
        settled: false,
        amount,
        receipt: outcome.value.receipt,
        session: outcome.value.session,
        idempotentReplay: outcome.value.idempotentReplay,
      },
    });
  }

  // ── PATH 2: CLASSIC x402 ──────────────────────────────────────────────────
  // No session and no payment header is not an error, it is the 402 that tells
  // a client what to send. This is the shape x402 clients already expect.
  const paymentHeader = req.headers['x-payment'];

  if (typeof paymentHeader !== 'string' || paymentHeader.length === 0) {
    return res.status(402).json({
      ...createX402PaymentRequirement(route ?? '/api/v1/x402/pay', amount),
      // The frictionless alternative, stated so an agent does not have to read
      // the docs to discover it.
      hint: 'Open a PabandiSession (POST /api/v1/engine/session/open) and pass its sessionId to spend without a per-payment signature.',
      pricing: {
        trustApiCall: X402_PRICING.TRUST_API_CALL,
        escrowInitiation: X402_PRICING.ESCROW_INITIATION,
      },
    });
  }

  const result = await verifyX402Payment({
    paymentHeader,
    resource: route ?? '/api/v1/x402/pay',
    amount,
  });

  if (!result.valid) {
    // verifyX402Payment never throws; it returns valid:false with a reason,
    // including when the facilitator could not be reached. Defaulting to
    // accept in that case would mean accepting payments that never happened.
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_NOT_VERIFIED',
      message: result.reason ?? 'Payment could not be verified',
    });
  }

  try {
    // The on-chain leg succeeded, so the payment is real even though there is
    // no session to record it against. Written as a SessionReceipt-like event
    // via the engine is not possible without a session, so this is logged and
    // returned; Phase 4 settlement reconciles these against the facilitator.
    logger.info(`[x402] verified payment amount=${amount} recipient=${recipientId ?? 'platform'} tx=${result.transactionHash ?? 'unknown'}`);

    return res.json({
      success: true,
      data: {
        method: 'x402',
        settled: true,
        amount,
        transactionHash: result.transactionHash ?? null,
        recipientId: recipientId ?? 'platform',
        description,
      },
    });
  } catch (err: unknown) {
    logger.error(`[x402] settlement bookkeeping failed: ${err instanceof Error ? err.message : String(err)}`);
    return res.status(500).json({ success: false, error: 'Payment accepted but bookkeeping failed' });
  }
});

export default router;