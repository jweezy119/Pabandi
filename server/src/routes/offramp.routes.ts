import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  createIntent,
  matchLp,
  submitProof,
  getIntents,
} from '../controllers/offramp.controller';

const router = Router();

router.post('/intent', authenticate, createIntent);
router.post('/lp/match', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), matchLp);
router.post('/lp/submit-proof', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), submitProof);
router.get('/lp/intents', authenticate, authorize('BUSINESS_OWNER', 'ADMIN'), getIntents);

export default router;
