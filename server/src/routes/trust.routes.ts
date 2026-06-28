import { Router } from 'express';
import { getPublicTrustProfile, getTrustAuditTimeline } from '../controllers/trust.controller';

const router = Router();

// Public endpoint for third-parties to verify a user's trust score
router.get('/public/:userId', getPublicTrustProfile);

// Get the audit timeline (could be protected by auth, but left open for demo)
router.get('/audit/:userId', getTrustAuditTimeline);

export default router;
