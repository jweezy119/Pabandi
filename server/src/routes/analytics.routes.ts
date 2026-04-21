import { Router } from 'express';
import { getAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorize('BUSINESS_OWNER', 'ADMIN'), getAnalytics);

export default router;
