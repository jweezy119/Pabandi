import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  recordConsent,
  getUserConsents,
  withdrawConsent,
  withdrawAllConsents,
  getConsentStatus,
} from '../controllers/consent.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/v1/consent - Record consent
router.post('/', recordConsent);

// GET /api/v1/consent - Get all user consents
router.get('/', getUserConsents);

// GET /api/v1/consent/status/:type - Get consent status for a type
router.get('/status/:type', getConsentStatus);

// POST /api/v1/consent/withdraw - Withdraw specific consent
router.post('/withdraw', withdrawConsent);

// POST /api/v1/consent/withdraw-all - Withdraw all consents of a type
router.post('/withdraw-all', withdrawAllConsents);

export default router;