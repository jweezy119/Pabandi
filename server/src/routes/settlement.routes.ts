import { Router } from 'express';
import { runSettlement, getSettlementStatus } from '../controllers/settlement.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// /run marks every CLAIMED-but-unsettled reward as settled in a single
// updateMany. That is the terminal state for the reward and it is irreversible
// from here, so it is admin-only — any authenticated user was able to close out
// the entire outstanding reward queue on demand, and to do so again immediately
// after. It also runs on an hourly timer (settlementService.startPeriodicSettlement),
// so the endpoint is a manual trigger for work that does not need a trigger.
router.get('/status', authenticate, getSettlementStatus);
router.post('/run', authenticate, authorize('ADMIN'), runSettlement);

export default router;
