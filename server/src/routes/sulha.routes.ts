import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sulhaService, SulhaError } from '../services/sulha.service';
import { arbitrationService } from '../services/arbitration.service';
import { prisma } from '../utils/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
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

// ─── Staked arbitrator panel (human review) ─────────────────────────────────
// The queue feeds the /contact/arbitration dashboard in the CRM. Reviews end
// in a click — Release to Seller or Refund Buyer — and each click IS the
// settlement: the panel route resolves through sulhaService.settleDispute, so
// the unfreeze, the engine settlement, and the trust events are exactly the
// ones the AI path uses. The passport's `isArbitrator` flag is the stake
// gate; per-dispute votes are recorded in panelVotes as the audit trail.

const resolveSchema = z.object({
  passportId: z.string().min(1).max(128),
  verdict: z.enum(['seller', 'buyer']),
  note: z.string().max(2000).optional(),
});

/** Find the arbitrator's passport by id or handle, requiring the panel flag. */
async function findArbitrator(passportIdOrHandle: string) {
  const byId = await prisma.trustPassport.findUnique({
    where: { id: passportIdOrHandle },
    select: { id: true, isArbitrator: true, displayName: true },
  });
  const passport = byId ?? (await prisma.trustPassport.findUnique({
    where: { handle: passportIdOrHandle },
    select: { id: true, isArbitrator: true, displayName: true },
  }));
  return passport && passport.isArbitrator ? passport : null;
}

router.get('/panel/queue', authenticate, apiLimiter, async (_req: AuthRequest, res: Response) => {
  const rows = await prisma.escrowDispute.findMany({
    where: { status: { in: ['open', 'ai_review', 'human_review'] } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  return res.json({ success: true, data: { queue: rows.map((row) => sulhaService.toView(row)) } });
});

router.post('/panel/:id/resolve', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'INVALID_BODY', issues: parsed.error.issues });
  }

  const arbitrator = await findArbitrator(parsed.data.passportId);
  if (!arbitrator) {
    // 403 rather than 404: the body was well-formed and the caller exists —
    // what failed is the authorization to rule, not the lookup.
    return res.status(403).json({ success: false, error: 'NOT_ARBITRATOR' });
  }

  const disputeRow = await prisma.escrowDispute.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true },
  });
  if (!disputeRow) return res.status(404).json({ success: false, error: 'DISPUTE_NOT_FOUND' });
  if (!['open', 'ai_review', 'human_review'].includes(disputeRow.status)) {
    return res.status(409).json({ success: false, error: 'DISPUTE_ALREADY_RESOLVED' });
  }

  // The vote is recorded BEFORE the settlement so the audit trail survives an
  // escrow failure — a lost vote is worse than a deferred unfreeze.
  const current = await prisma.escrowDispute.findUnique({
    where: { id: req.params.id },
    select: { panelVotes: true },
  });
  const votes = Array.isArray(current?.panelVotes) ? ([...(current?.panelVotes as object[])] as Record<string, unknown>[]) : [];
  const existingIndex = votes.findIndex((v) => (v as { passportId?: string }).passportId === arbitrator.id);
  const voteRecord = {
    passportId: arbitrator.id,
    displayName: arbitrator.displayName,
    vote: parsed.data.verdict,
    votedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) votes[existingIndex] = voteRecord;
  else votes.push(voteRecord);
  await prisma.escrowDispute.update({ where: { id: req.params.id }, data: { panelVotes: votes as object } });

  try {
    const dispute = await sulhaService.settleDispute({
      disputeId: req.params.id,
      verdict: parsed.data.verdict,
      resolutionNotes: `Panel ruling by ${arbitrator.displayName}${parsed.data.note ? `: ${parsed.data.note}` : ''}`,
      source: 'panel',
    });
    return res.json({ success: true, data: { dispute } });
  } catch (err: unknown) {
    if (err instanceof SulhaError) {
      return res.status(errorStatus(err.code)).json({ success: false, error: err.code, message: err.message });
    }
    throw err;
  }
});

export default router;
