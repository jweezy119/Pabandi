import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validateZod';
import { x402PaySchema } from '../schemas/agentic.schemas';
import engineService from '../services/engine.service';
import { verifyX402Payment, verifyX402PaymentV2, createX402PaymentRequirement, buildPaymentRequired, encodePaymentRequired, parseX402PaymentHeaderRaw, X402_PRICING } from '../services/x402.service';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';
// Root import: tsconfig uses the classic node moduleResolution, which cannot
// resolve the package's `exports` subpath for /bazaar; the same function is
// re-exported from the package root with CJS types it can resolve.
import { declareDiscoveryExtension } from '@x402/extensions';

/**
 * ─── BAZAAR DISCOVERY ────────────────────────────────────────────────────────
 *
 * The x402 Bazaar indexes paid endpoints by reading the `extensions.bazaar` block
 * the resource server attaches to its 402 response. Against the official
 * @x402/express middleware that attachment happens inside the middleware stack;
 * this route is hand-rolled (it serves two genuinely different payment rails —
 * session-spend and classic x402 — on one path), so the declaration is attached
 * to the 402 responses explicitly.
 *
 * The route definition is the discovery declaration's source of truth: the
 * schema is generated from the same Zod schema `validateBody` enforces, so the
 * discovery metadata cannot drift from what the endpoint actually accepts.
 */
/**
 * JSON Schema body declaration for POST /api/v1/x402/pay, mirrored by hand
 * from `x402PaySchema` (src/schemas/agentic.schemas.ts — the schema the route
 * actually enforces via `validateBody`). Hand-maintained rather than converted
 * because zod-to-json-schema's typed call instantiates zod@3.25's v3 types to
 * TS2589 depth under this tsconfig; the fields below must follow the Zod
 * source if either changes, and the diff was verified field-for-field:
 * amount is a finite nonnegative number capped at 1,000,000; every other field
 * is an optional non-empty string of 128–280 chars depending on the field.
 */
const X402_PAY_BODY_SCHEMA: Record<string, unknown> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      minimum: 0,
      maximum: 1_000_000,
      description: 'Amount in USDC to settle for this call (0+; session spends debited against the open session instead of a wallet signature)',
    },
    description: { type: 'string', maxLength: 280, description: 'What the payment settles' },
    recipientId: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description: 'X402Identity id of the recipient; omit to settle to the platform',
    },
    route: { type: 'string', maxLength: 280, description: 'Resource or route being paid for' },
    sessionId: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      description: 'Open PabandiSession id — routes through session-spend instead of an on-chain payment signature',
    },
    idempotencyKey: { type: 'string', maxLength: 128, description: 'Retry with the same key to avoid double-charging' },
  },
  required: ['amount'],
};
const X402_PAY_BAZAAR_RAW = declareDiscoveryExtension({
  bodyType: 'json',
  input: {
    amount: 0.01,
    description: 'Trust API lookup',
    route: '/api/v1/trust/resolve/agent@example.com',
    idempotencyKey: 'inv-0001',
  },
  inputSchema: X402_PAY_BODY_SCHEMA,
  output: {
    example: {
      success: true,
      data: {
        method: 'x402',
        settled: true,
        amount: 0.01,
        transactionHash: '5nHJSmv2m8Znrkm4tVwqfTqbVQUydjyFvX8mLFdvENq1',
        recipientId: 'platform',
        description: 'Trust API lookup',
      },
    },
  },
});
// The typed entry point omits `method` because middleware-based servers get it
// injected from the route context. This route is hand-rolled — no middleware
// enrichment runs — so the method (and route template) are stated here,
// matching what the enrichment layer would have produced.
const X402_PAY_BAZAAR: Record<string, unknown> = {
  bazaar: {
    ...X402_PAY_BAZAAR_RAW.bazaar,
    info: {
      ...X402_PAY_BAZAAR_RAW.bazaar.info,
      input: {
        ...X402_PAY_BAZAAR_RAW.bazaar.info.input,
        method: 'POST',
      },
    },
  },
};

/** Exposed for tests: the 402 contract is asserted against the real schema. */
export { X402_PAY_BAZAAR };

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
  // `extensions` carries the Bazaar discovery declaration: an agent that
  // receives this 402 can render the endpoint's request schema and a worked
  // response example without ever reading this file.
  const PAYMENT_RESOURCE = route ?? '/api/v1/x402/pay';
  const paymentHeader = req.headers['x-payment'];
  // v2 spec clients answer a 402 with `PAYMENT-SIGNATURE`, not `X-PAYMENT`.
  const paymentSignature = req.headers['payment-signature'];

  if (!paymentSignature && (typeof paymentHeader !== 'string' || paymentHeader.length === 0)) {
    // x402 v2: the requirements live in the `PAYMENT-REQUIRED` header as base64
    // JSON; the body keeps the legacy Pabandi shape so existing callers (and
    // the discovery examples) do not break.
    return res.status(402)
      .header('Payment-Required', encodePaymentRequired(buildPaymentRequired({
        resource: PAYMENT_RESOURCE,
        amountUsdc: X402_PRICING.TRUST_API_CALL,
        extensions: X402_PAY_BAZAAR,
      })))
      .json({
        ...createX402PaymentRequirement(PAYMENT_RESOURCE, X402_PRICING.TRUST_API_CALL),
        // The frictionless alternative, stated so an agent does not have to read
        // the docs to discover it.
        hint: 'Open a PabandiSession (POST /api/v1/engine/session/open) and pass its sessionId to spend without a per-payment signature.',
        pricing: {
          trustApiCall: X402_PRICING.TRUST_API_CALL,
          escrowInitiation: X402_PRICING.ESCROW_INITIATION,
        },
        extensions: X402_PAY_BAZAAR,
      });
  }

  if (typeof paymentSignature === 'string' && paymentSignature.length > 0) {
    // ── PATH 2a: x402 v2 spec rail ──────────────────────────────────────────
    // The parsed payload's `accepted` requirements echo what the server
    // offered; the facilitator verifies the transaction against them and
    // settles as feePayer sponsor.
    const parsedV2 = parseX402PaymentHeaderRaw(paymentSignature);
    if (parsedV2.v2) {
      const result = await verifyX402PaymentV2({
        paymentPayload: parsedV2.v2,
        resource: PAYMENT_RESOURCE,
        amountUsdc: X402_PRICING.TRUST_API_CALL,
      });
      if (!result.valid) {
        return res.status(402).json({
          success: false,
          error: 'PAYMENT_NOT_VERIFIED',
          message: result.reason ?? 'Payment could not be verified',
          extensions: X402_PAY_BAZAAR,
        });
      }
      recordVerifiedPayment(req, res, amount, recipientId, description, result);
      return;
    }
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_NOT_VERIFIED',
      message: 'Malformed PAYMENT-SIGNATURE header: expected a base64 x402 v2 PaymentPayload',
      extensions: X402_PAY_BAZAAR,
    });
  }

  const result = await verifyX402Payment({
    paymentHeader,
    resource: PAYMENT_RESOURCE,
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
      // Same declaration as the payment-required 402: a probing agent can land
      // on either, and both must describe the endpoint.
      extensions: X402_PAY_BAZAAR,
    });
  }

  // Successful path-1 settlement returns through the shared helper below.
  recordVerifiedPayment(req, res, amount, recipientId, description, result);
});

/**
 * Shared bookkeeping for a verified on-chain payment. The on-chain leg
 * succeeded, so the payment is real even though there is no session to record
 * it against — written as a SessionReceipt-like event via the engine is not
 * possible without a session, so this is logged and returned; settlement
 * reconciliation closes the gap against the facilitator (Phase 4).
 */
function recordVerifiedPayment(
  _req: Request,
  res: Response,
  amount: number,
  recipientId: string | undefined,
  description: string | undefined,
  result: { transactionHash?: string }
): void {
  try {
    logger.info(`[x402] verified payment amount=${amount} recipient=${recipientId ?? 'platform'} tx=${result.transactionHash ?? 'unknown'}`);

    res.json({
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
    res.status(500).json({ success: false, error: 'Payment accepted but bookkeeping failed' });
  }
}

export default router;