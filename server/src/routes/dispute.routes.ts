import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { disputeService } from '../services/dispute.service';
import { prisma } from '../utils/database';

const router = Router();

router.post('/', authenticate, async (req: any, res: Response) => {
  try {
    const { reservationId, contextType, contextId, againstId, reason, evidenceUrls, stakedAmount, escrowId } = req.body;
    const filedById = req.user.id;

    if (!againstId || !reason) {
      return res.status(400).json({ error: 'Missing required fields: againstId and reason' });
    }

    const dispute = await disputeService.fileContextDispute({
      contextType: escrowId ? 'ESCROW' : (contextType || 'BOOKING'),
      contextId: escrowId || contextId || reservationId || 'N/A',
      filedById,
      againstId,
      reason,
      evidenceUrls,
      stakedAmount: stakedAmount || 0,
    });

    return res.status(201).json({ success: true, dispute });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/context', authenticate, async (req: any, res: Response) => {
  try {
    const { contextType, contextId, againstId, reason, evidenceUrls, stakedAmount } = req.body;
    const filedById = req.user.id;

    if (!contextType || !contextId || !againstId || !reason) {
      return res.status(400).json({ error: 'Missing required fields: contextType, contextId, againstId, reason' });
    }

    const dispute = await disputeService.fileContextDispute({
      contextType,
      contextId,
      filedById,
      againstId,
      reason,
      evidenceUrls,
      stakedAmount,
    });

    return res.status(201).json({ success: true, dispute });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: { reporter: true, user: true },
    });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    return res.json({ dispute });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/:id/vote', authenticate, async (req: any, res: Response) => {
  try {
    const disputeId = req.params.id;
    const jurorId = req.user.id;
    const { voteForId, reason } = req.body;

    if (!voteForId) {
      return res.status(400).json({ error: 'Must specify voteForId' });
    }

    const vote = await disputeService.castVote(disputeId, jurorId, voteForId, reason);
    return res.status(200).json({ success: true, vote });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/:id/evidence', authenticate, async (req: any, res: Response) => {
  try {
    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    const evidenceUrls = req.body.evidenceUrls || (req.body.evidence ? [req.body.evidence] : []);
    const updated = await prisma.dispute.update({
      where: { id: req.params.id },
      data: {
        evidenceUrls: {
          push: evidenceUrls,
        },
      },
    });
    return res.status(201).json({ success: true, dispute: updated });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
