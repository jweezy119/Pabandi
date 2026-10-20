import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validateZod';
import {
  engineSessionOpenSchema,
  engineSessionActionSchema,
  engineSessionCloseSchema,
} from '../schemas/agentic.schemas';
import engineService from '../services/engine.service';
import { resolveTrustScore } from '../services/trust.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Pabandi Engine HTTP surface.
 *
 * `/session/action` (aliased as `/action`) is the high-frequency endpoint and
 * is written for that: no database read on the happy path beyond the session
 * row itself, and errors returned as a body rather than thrown, because the
 * alternative is a stack trace in the logs for what is a routine condition (a
 * session running out of room is not an exception, it is the feature working).
 *
 * Auth remains deliberately absent. The artefact a caller presents here is the
 * sessionId, and possession of a session's id is what authorises a spend
 * against its remaining limit — the same model the tab was opened under. Gating
 * these routes on a bearer token as well would just move the credential a
 * leaked session would need. Who is allowed to open a session for which owner
 * is checked where it can actually be checked: `/session/open` resolves the
 * caller's Trust Score server-side, so a claimed score can lower a tier but
 * never raise it.
 */

// ── POST /session/open ───────────────────────────────────────────────────────

router.post('/session/open', validateBody(engineSessionOpenSchema), async (req: Request, res: Response) => {
  try {
    const { ownerType, ownerId, trustScore } = req.body as {
      ownerType: 'user' | 'agent';
      ownerId: string;
      trustScore?: number;
    };

    // ── TRUST SCORE IS RESOLVED SERVER-SIDE ─────────────────────────────────
    // This used to trust a client-supplied `trustScore`, which meant a caller
    // could claim 800 and receive the $1000/30-day tier. Now the score comes
    // from trust.service, which reads the principal's real score.
    //
    // A request-supplied `trustScore` is still accepted, but as a FLOOR: it can
    // lower the tier and never raise it. An agent with no score of its own can
    // therefore declare itself unproven, but cannot declare itself proven.
    // Failing closed on the unknown case is the point -- defaulting an
    // unrecognised principal to the middle tier would let anyone who knew the
    // endpoint open a large tab by being new.
    const resolved = await resolveTrustScore(ownerType, ownerId);
    const effectiveScore = Math.min(resolved.score, trustScore ?? resolved.score);

    const session = await engineService.openSession(ownerType, ownerId, effectiveScore);

    return res.status(201).json({
      success: true,
      data: { ...session, trustScore: effectiveScore },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Engine] session/open error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

// ── POST /session/action | /action ───────────────────────────────────────────

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

async function sessionActionHandler(req: Request, res: Response) {
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
}

router.post('/session/action', validateBody(engineSessionActionSchema), sessionActionHandler);

// ── POST /action — alias ─────────────────────────────────────────────────────
// The Phase 5 checkout contract names POST /api/v1/engine/action as the single
// call the frontend makes. Same schema, same handler, both registered so
// neither callers nor docs have to version-guess which of the two shapes is
// canonical.
router.post('/action', validateBody(engineSessionActionSchema), sessionActionHandler);

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