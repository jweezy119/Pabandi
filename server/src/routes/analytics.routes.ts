import { Router } from 'express';
import { getAnalytics, getDetailedAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', authorize('BUSINESS_OWNER', 'ADMIN'), getAnalytics);
router.get('/detailed', authorize('BUSINESS_OWNER', 'ADMIN'), getDetailedAnalytics);

export default router;
