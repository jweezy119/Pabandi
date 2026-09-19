import { Router } from 'express';
import { runSettlement, getSettlementStatus } from '../controllers/settlement.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/status', authenticate, getSettlementStatus);
router.post('/run', authenticate, runSettlement);

export default router;
