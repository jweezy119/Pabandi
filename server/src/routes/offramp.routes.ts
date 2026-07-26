import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createIntent,
  matchLp,
  submitProof,
  getIntents,
  acceptProof,
  expireStaleIntents,
  listProviders,
  registerProvider,
  testWebhookDelivery,
} from '../controllers/offramp.controller';

const router = Router();

router.post('/intent', authenticate, createIntent);
router.post('/lp/match', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), matchLp);
router.post('/lp/submit-proof', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), submitProof);
router.post('/lp/accept-proof', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), acceptProof);
router.post('/admin/expire-stale', authenticate, authorize('ADMIN'), expireStaleIntents);
router.get('/providers', authenticate, listProviders);
router.post('/providers/register', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), registerProvider);
router.post('/dev/test-webhook', authenticate, authorize('ADMIN'), testWebhookDelivery);

export default router;
