import { Router } from 'express';
import { prisma } from '../utils/database';
import { DisputeService } from '../services/dispute.service';
import { authenticate } from '../middleware/auth.middleware';
import { DisputeOutcome } from '@prisma/client';

const router = Router();
const disputeService = new DisputeService();

/**
 * @route POST /api/v1/disputes
 * @desc File a dispute (legacy reservation-based)
 * @desc SULHA: a body with `escrowId` raises an escrow dispute instead — the
 * Optimistic Arbitration flow (sulha.service). Body shape is the
 * discriminator: reservationId -> reservation jury, escrowId -> Sulha escrow
 * freeze. That keeps the documented POST /api/v1/disputes contract serving
 * both products without a shape change under existing callers.
 */
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { reservationId, escrowId, raisedByPassport, sessionId } = req.body;
    const { reason, evidenceJson } = req.body;

    if (escrowId) {
      const sulha = await import('../services/sulha.service');
      const dispute = await sulha.sulhaService.raiseDispute({
        escrowId,
        raisedByPassport: raisedByPassport || req.user.id,
        reason: reason || req.body.description || 'Disputed escrow',
        evidenceJson: evidenceJson || {},
        sessionId,
      });
      return res.status(201).json({ message: 'Escrow disputed (frozen by Sulha)', dispute });
    }

    const againstId = req.body.againstId;
    const filedById = req.user.id;
    const evidenceUrls = req.body.evidenceUrls;
    const stakedAmount = req.body.stakedAmount;

    if (!reservationId || !againstId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dispute = await disputeService.createDispute(
      reservationId,
      filedById,
      againstId,
      reason,
      evidenceUrls || [],
      stakedAmount || 10
    );

    res.status(201).json({ message: 'Dispute filed successfully', dispute });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/disputes/context
 * @desc File a dispute against a paid-work context (milestone release / off-ramp payout).
 *       This is the #3 "dispute arbitration" entry point for pay-on-verified-work & off-ramp.
 */
router.post('/context', authenticate, async (req: any, res) => {
  try {
    const { contextType, contextId, againstId, type, description, evidenceUrls, stakedAmount } = req.body;
    if (!contextType || !contextId || !againstId || !description) {
      return res.status(400).json({ error: 'contextType, contextId, againstId, and description are required' });
    }
    const dispute = await disputeService.fileContextDispute({
      reportedById: req.user.id,
      againstId,
      contextType,
      contextId,
      type,
      description,
      evidenceUrls: evidenceUrls || [],
      stakedAmount,
    });
    res.status(201).json({ message: 'Dispute filed', dispute });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /api/v1/disputes
 * @desc List disputes (open ones for jurors; all for admins). Public-friendly: returns
 *       enough for the community arbitration board without leaking PII.
 */
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.outcome = status;
    else where.outcome = { in: [DisputeOutcome.PENDING, (DisputeOutcome as any).VOTING] };
    const list = await prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { votes: true },
    });
    // Attach each disputed party's (userId) latest background-check verdict
    // so jurors see the real trust signal while voting. Disputed party = userId.
    const userIds = [...new Set(list.map((d: any) => d.userId as string).filter(Boolean))];
    const checksByUser: Record<string, any> = {};
    if (userIds.length) {
      const rs = await prisma.backgroundCheck.findMany({
        where: { subjectId: { in: userIds }, status: 'COMPLETE', recommendation: { in: ['PASS', 'REVIEW', 'REJECT'] } },
        orderBy: { updatedAt: 'desc' },
      });
      for (const c of rs) { const sid = c.subjectId as string; if (sid && !checksByUser[sid]) { checksByUser[sid] = c; } }
    }
    const disputes = list.map((d: any) => ({
      ...d,
      check: d.userId ? checksByUser[d.userId] ?? null : null,
    }));
    res.json({ disputes });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /api/v1/disputes/:id
 * @desc Dispute detail (public arbitration view).
 * @desc SULHA: an EscrowDispute id resolves to the Sulha record instead of the
 * reservation jury table — one id space, both dispute products distinguishable
 * by which table the id hits first.
 */
router.get('/:id', async (req: any, res) => {
  try {
    const { prisma } = require('../utils/database');
    // Sulha record first — its ids and the legacy Dispute ids share a cuid
    // format, so a failed legacy lookup must not be read as "not found" before
    // the other table has been asked.
    const sulha = await import('../services/sulha.service');
    const sulhaDispute = await sulha.sulhaService.getDispute(req.params.id);
    if (sulhaDispute) {
      return res.json({
        dispute: sulhaDispute,
        frozen: ['open', 'ai_review', 'human_review'].includes(sulhaDispute.status),
      });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: { votes: true },
    });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    // Attach the disputed party's latest background-check verdict (real signal).
    let check: any = null;
    if (dispute.userId) {
      check = await prisma.backgroundCheck.findFirst({
        where: { subjectId: dispute.userId, status: 'COMPLETE', recommendation: { in: ['PASS', 'REVIEW', 'REJECT'] } },
        orderBy: { updatedAt: 'desc' },
      });
    }
    res.json({ dispute: { ...dispute, check: check ?? null } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/disputes/:id/vote
 * @desc Cast a vote on an active dispute (peer juror, trust score > 90)
 */
router.post('/:id/vote', authenticate, async (req: any, res) => {
  try {
    const disputeId = req.params.id;
    const jurorId = req.user.id;
    const { voteForId, reason } = req.body;

    if (!voteForId) {
      return res.status(400).json({ error: 'Must specify who you are voting for (voteForId)' });
    }

    const vote = await disputeService.castVote(disputeId, jurorId, voteForId, reason);
    res.status(200).json({ message: 'Vote cast successfully', vote });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/disputes/:id/evidence
 * @desc SULHA: append evidence to an escrow dispute (delegate to sulha.service;
 * the Sulha record, the escrow freeze, and the party gate live there).
 */
router.post('/:id/evidence', authenticate, async (req: any, res) => {
  try {
    const sulha = await import('../services/sulha.service');
    const takenPassport = req.body.passportId || req.body.raisedByPassport || req.user.id;
    const dispute = await sulha.sulhaService.appendEvidence(req.params.id, takenPassport, req.body.evidence ?? req.body.evidenceJson ?? {});
    return res.status(201).json({ success: true, dispute });
  } catch (error: any) {
    const code = error?.code as string | undefined;
    const status = code === 'DISPUTE_NOT_FOUND' ? 404 : code === 'DISPUTE_ALREADY_RESOLVED' ? 409 : code === 'NOT_A_PARTY' ? 403 : 400;
    return res.status(status).json({ error: code ?? error.message, message: error.message });
  }
});

/**
 * @route POST /api/v1/disputes/migrate
 * @desc Add contextType/contextId columns (Cloud Run FS read-only)
 */router.post('/migrate', async (_req: any, res: any) => {
  try {
    const { prisma } = require('../utils/database');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "contextType" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "contextId" TEXT`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Dispute_ctx_idx" ON "Dispute"("contextType","contextId")`);
    res.json({ success: true, message: 'Dispute columns migrated' });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
