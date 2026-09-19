import { Router } from 'express';
import {
  getProfitReport,
  runManualCycle,
  getArbitrageStatus,
  getSettlementSpeed,
  getLearningLog
} from '../controllers/profitEngine.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/report', authenticate, getProfitReport);
router.post('/cycle', authenticate, runManualCycle);
router.get('/arbitrage', authenticate, getArbitrageStatus);
router.get('/settlement', getSettlementSpeed);
router.get('/learning', authenticate, getLearningLog);

export default router;
