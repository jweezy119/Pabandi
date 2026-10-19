import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validateZod';
import {
  engineSessionOpenSchema,
  engineSessionActionSchema,
  engineSessionCloseSchema,
} from '../schemas/agentic.schemas';
import engineService from '../services/engine.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Pabandi Engine HTTP surface.
 *
 * `/session/action` is the high-frequency endpoint and is written for that:
 * no database read on the happy path, no logging on success, and errors
 * returned as a body rather than thrown, because the alternative is a stack
 * trace in the logs for what is a routine condition (a session running out of
 * room is not an exception, it is the feature working).
 *
 * Auth is deliberately absent here. Phase 2 adds the session mechanism; who is
 * allowed to open a session for which owner is Phase 4's job, alongside the
 * x402 and MCP wiring, and inventing a half-auth here would create a route
 * that looks gated and is not. Every handler below is reachable without a
 * credential until that lands.
 */

// ── POST /session/open ───────────────────────────────────────────────────────

router.post('/session/open', validateBody(engineSessionOpenSchema), async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId, trustScore } = req.body as {
      ownerType: 'user' | 'agent';
      ownerId: string;
      trustScore?: number;
    };

    // ── TRUST SCORE IS NOT AUTHORITATIVE YET ────────────────────────────────
    // This route accepts a client-supplied `trustScore`, which means a caller
    // can currently claim 800 and receive the $1000/30-day tier. That is fine
    // for an unreleased endpoint and is not fine in production.
    //
    // The fix is to resolve the score server-side here -- from
    // TrustPassport.paymentScore for an agent, from the User's reliability
    // score for a user -- and to let the request field act only as a floor
    // that can lower the tier and never raise it. That lookup needs the trust
    // service Phase 3 puts behind Redis, so it lands there rather than being
    // written twice.
    //
    // Absent a score, the caller gets the least-privileged tier. Failing
    // closed here means an unrecognised principal cannot open a large tab by
    // omitting the field.
    const effectiveScore = trustScore ?? 0;

    const session = await engineService.openSession(ownerType, ownerId, effectiveScore);

    return res.status(201).json({ success: true, data: session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Engine] session/open error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── POST /session/action ─────────────────────────────────────────────────────

/**
 * Failure -> status code. Kept as a table rather than inlined so the mapping is
 * visible in one place; a caller that cannot distinguish "closed" from
 * "exhausted" cannot act on either.
 */
const FAILURE_STATUS: Record<string, number> = {
  SESSION_NOT_FOUND: 404,
  SESSION_NOT_ACTIVE: 409,
  SESSION_EXPIRED: 410,
  LIMIT_EXCEEDED: 402,
  CONCURRENT_SPEND: 409,
  INVALID_AMOUNT: 400,
};

router.post('/session/action', validateBody(engineSessionActionSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      sessionId: string;
      actionType: string;
      amount: number;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
    };

    const outcome = await engineService.executeTransaction({
      sessionId: body.sessionId,
      actionType: body.actionType,
      amount: body.amount,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
    });

    if (!outcome.ok) {
      const status = FAILURE_STATUS[outcome.error.code] ?? 400;
      return res.status(status).json({ success: false, error: outcome.error.code, ...outcome.error });
    }

    return res.status(200).json({ success: true, data: outcome.value });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Engine] session/action error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── POST /session/close ──────────────────────────────────────────────────────

router.post('/session/close', validateBody(engineSessionCloseSchema), async (req: Request, res: Response) => {
  try {
    const { sessionId, settle } = req.body as { sessionId: string; settle: boolean };

    const outcome = await engineService.closeSession(sessionId, settle);

    if (!outcome.ok) {
      const status = FAILURE_STATUS[outcome.error.code] ?? 400;
      return res.status(status).json({ success: false, error: outcome.error.code, ...outcome.error });
    }

    return res.status(200).json({ success: true, data: outcome.value });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Engine] session/close error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── GET /session/:id/receipts ────────────────────────────────────────────────

router.get('/session/:sessionId/receipts', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const receipts = await engineService.listReceipts(sessionId);
    return res.json({ success: true, data: receipts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Engine] receipts error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;