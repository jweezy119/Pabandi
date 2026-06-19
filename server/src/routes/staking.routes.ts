import { Router } from 'express';
import { stakeCollateral, resolveStake, releaseStake } from '../controllers/staking.controller';
import { authenticate as requireAuth, authorize } from '../middleware/auth.middleware';

const router = Router();

// User stakes collateral for a booking (Hamish Jiddiyyah)
router.post('/stake', requireAuth, stakeCollateral);

// Business claims actual damages from the earnest deposit
router.post('/resolve', requireAuth, authorize('BUSINESS_OWNER', 'BUSINESS_STAFF', 'ADMIN'), resolveStake);

// System/Business releases 100% of earnest money back to customer upon check-in
router.post('/release', requireAuth, authorize('BUSINESS_OWNER', 'BUSINESS_STAFF', 'ADMIN'), releaseStake);

export default router;
