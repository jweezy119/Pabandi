import { Router } from 'express';
import { DisputeService } from '../services/dispute.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const disputeService = new DisputeService();

/**
 * @route POST /api/v1/disputes
 * @desc File a new peer-jury dispute
 */
router.post('/', authenticate, async (req: any, res) => {
  try {
    const { reservationId, againstId, reason, evidenceUrls, stakedAmount } = req.body;
    const filedById = req.user.id;

    if (!reservationId || !againstId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dispute = await disputeService.createDispute(
      reservationId,
      filedById,
      againstId,
      reason,
      evidenceUrls || [],
      stakedAmount || 10 // default stake
    );

    res.status(201).json({ message: 'Dispute filed successfully', dispute });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/disputes/:id/vote
 * @desc Cast a vote on an active dispute
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

export default router;
