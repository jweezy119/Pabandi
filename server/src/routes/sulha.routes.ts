import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sulhaService, SulhaError } from '../services/sulha.service';
import { arbitrationService } from '../services/arbitration.service';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';

/**
 * sulha.routes.ts — the Optimistic Arbitration API.
 *
 * Endpoints (all mounted under /api/v1/sulha):
 *   POST /disputes              raise a dispute, freezing the escrow
 *   GET  /disputes/:id          status of a dispute (A2A-readable machine view)
 *   POST /disputes/:id/evidence append evidence for the arbitrator to read
 *
 * The staked arbitrator panel endpoints surface in commit 3 and live in this
 * same router so the whole Sulha API reads from one file.
 *
 * Deliberately under its own namespace: the legacy `/api/v1/disputes` router
 * carries a different dispute product (reservation-jury voting for bookings),
 * and merging the two would force one raise contract to change shape under its
 * existing callers. The legacy router gains thin delegates so the documented
 * external contract (POST /api/v1/disputes with an `escrowId` in the body)
 * also reaches this service — see dispute.routes.ts for the body-shape
 * discriminator that keeps both entry points accurate without ambiguity.
 */

const raiseSchema = z.object({
  escrowId: z.string().min(1).max(128),
  raisedByPassport: z.string().min(1).max(128),
  reason: z.string().min(3).max(2000),
  evidenceJson: z.object({}).passthrough().optional().default({}),
  /** Optional engine-session linkage, for the close blocker. */
  sessionId: z.string().min(1).max(128).optional(),
});

const evidenceSchema = z.object({
  passportId: z.string().min(1).max(128),
  evidence: z.object({}).passthrough(),
});

function errorStatus(code: string): number {
  switch (code) {
    case 'ESCROW_NOT_FOUND':
    case 'DISPUTE_NOT_FOUND':
      return 404;
    case 'DISPUTE_ALREADY_OPEN':
    case 'DISPUTE_ALREADY_RESOLVED':
      return 409;
    case 'NOT_A_PARTY':
      return 403;
    default:
      return 500;
  }
}

const router = Router();

router.post('/disputes', writeLimiter, async (req: Request, res: Response) => {
  const parsed = raiseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'INVALID_BODY', issues: parsed.error.issues });
  }
  try {
    const dispute = await sulhaService.raiseDispute(parsed.data);
    // Commit 2: the raise hears the machine arbitrator. queueArbitration flips
    // the dispute to ai_review before returning, then runs Jev in the
    // background — a decisive verdict auto-resolves, anything else waits for
    // the human panel.
    const arbitration = await arbitrationService.queueArbitration(dispute.id);
    return res.status(201).json({
      success: true,
      data: { dispute: { ...dispute, status: arbitration.queued ? 'ai_review' : dispute.status }, arbitration: arbitration.queued ? 'queued' : 'skipped' },
    });
  } catch (err: unknown) {
    if (err instanceof SulhaError) {
      return res.status(errorStatus(err.code)).json({ success: false, error: err.code, message: err.message });
    }
    throw err;
  }
});

router.get('/disputes/:id', apiLimiter, async (req: Request, res: Response) => {
  const dispute = await sulhaService.getDispute(req.params.id);
  if (!dispute) return res.status(404).json({ success: false, error: 'DISPUTE_NOT_FOUND' });
  return res.json({
    success: true,
    data: {
      dispute,
      // The machine-readable verdict of the freeze, for A2A callers that only
      // need a "can this escrow settle?" answer without parsing the record.
      frozen: getFrozen(dispute.status),
    },
  });
});

router.post('/disputes/:id/evidence', writeLimiter, async (req: Request, res: Response) => {
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'INVALID_BODY', issues: parsed.error.issues });
  }
  // Evidence names a passport because the right to strengthen a case belongs
  // to a counterparty's identity, not to whoever holds a bearer token: an
  // account "for" a vendor must not be able to pose as the buyer's counsel.
  try {
    const dispute = await sulhaService.appendEvidence(req.params.id, parsed.data.passportId, parsed.data.evidence);
    return res.status(201).json({ success: true, data: { dispute } });
  } catch (err: unknown) {
    if (err instanceof SulhaError) {
      return res.status(errorStatus(err.code)).json({ success: false, error: err.code, message: err.message });
    }
    throw err;
  }
});

const getFrozen = (status: string): boolean => ['open', 'ai_review', 'human_review'].includes(status);

export default router;
