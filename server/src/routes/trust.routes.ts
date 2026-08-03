import { Router } from 'express';
import {
  getMyTrustProfile,
  getMyTrustAuditTimeline,
  getMyTrustStamps,
  createMyTrustStamp,
  getActionRequirements,
  checkMyActionAccess,
  recordGuestEscrowEvent,
  streamTrustPulse,
} from '../controllers/trust.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/public/:userId', getMyTrustProfile);
router.get('/audit/:userId', getMyTrustAuditTimeline);
router.get('/score/me', authenticate, getMyTrustProfile);
router.get('/stamps/me', authenticate, getMyTrustStamps);
router.post('/stamps/issue', authenticate, createMyTrustStamp);
router.get('/requirements/:action', getActionRequirements);
router.post('/action/:action/check', authenticate, checkMyActionAccess);
router.post('/guest/escrow-event', recordGuestEscrowEvent);
router.get('/pulse/:userId', streamTrustPulse);

/**
 * GET /api/v1/trust/flux/:userId
 * Returns TrustFlux trajectory data (velocity-driven GNN prediction).
 * Public endpoint — anyone can check a user's trust trend direction.
 */
router.get('/flux/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { trustFluxService } = await import('../services/trustFlux.service');
    const flux = await trustFluxService.computeTrustFlux(userId);
    res.json({ success: true, data: flux });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
