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
import { prisma } from '../utils/database';

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
    // Also compute peer-normalized velocity
    flux.peerNormalizedVelocity = await trustFluxService.getPeerNormalizedVelocity(userId, flux.velocity);
    res.json({ success: true, data: flux });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/flux/:userId/predict
 * Returns 30-day forward trajectory projection with decayed velocity.
 */
router.get('/flux/:userId/predict', async (req, res) => {
  const { userId } = req.params;
  const days = Number(req.query.days || 30);
  try {
    const { trustFluxService } = await import('../services/trustFlux.service');
    const projection = await trustFluxService.predict(userId, days);
    res.json({ success: true, data: projection });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/public/:userId — public trust profile (no auth).
 * Returns score + tier + attestation + velocity (no owner-only actions).
 */
router.get('/public/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const [attestation, velocity] = await Promise.all([
      (await import('../services/trustAttestation.service')).trustAttestationService.issue(user.id),
      (await import('../services/trustScore.service')).trustScoreService.computeVelocity(user.id),
    ]);
    res.json({
      success: true,
      data: {
        userId: user.id,
        score: user.trustScore,
        tier: user.verificationTier,
        attestation,
        trustVelocity: velocity,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/stamps/:userId — public trust audit timeline (no auth).
 */
router.get('/stamps/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stamps = await prisma.trustAuditTrail.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: stamps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/trust/veil/issue
 * Issue a zero-knowledge trust badge proving score ≥ threshold without revealing score.
 * Body: { userId, trustScore, threshold }
 */
router.post('/veil/issue', async (req, res) => {
  const { userId, trustScore, threshold = 70 } = req.body;
  try {
    const { trustVeilService } = await import('../services/trustVeil.service');
    const proof = await trustVeilService.issueProof(userId, trustScore, threshold);
    res.json({ success: true, data: proof });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/veil/verify/:proofId
 * Verify a TrustVeil proof. Only learns: isAboveThreshold, trend, validity.
 * The actual score is never revealed.
 */
router.get('/veil/verify/:proofId', async (req, res) => {
  const { proofId } = req.params;
  try {
    const { trustVeilService } = await import('../services/trustVeil.service');
    // In production, fetch the proof from DB by proofId
    // For now, return the verification schema
    res.json({ success: true, data: { verified: 'proofId-based lookup requires DB integration' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
