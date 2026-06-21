import { Router } from 'express';
import { analyzeDemand, confirmOrder, getTrends, launchService, consultAdvisor } from '../controllers/sourcing.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/analyze', analyzeDemand);
router.post('/order/:orderId/confirm', confirmOrder);
router.post('/consult', consultAdvisor);

// New Trend-to-Service endpoints
router.get('/trends', getTrends);
router.post('/trends/:trendId/launch', launchService);

export default router;
