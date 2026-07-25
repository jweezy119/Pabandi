import { Router } from 'express';
import {
  getMyTrustProfile,
  getMyTrustAuditTimeline,
  getMyTrustStamps,
  createMyTrustStamp,
  getActionRequirements,
  checkMyActionAccess,
  recordGuestEscrowEvent,
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

export default router;
