import { Router } from 'express';
import { stakeCollateral, slashStake } from '../controllers/staking.controller';
import { authenticate as requireAuth, authorize } from '../middleware/auth.middleware';

const router = Router();

// User stakes collateral for a booking
router.post('/stake', requireAuth, stakeCollateral);

// System or Business slashes stake upon a verified no-show
router.post('/slash', requireAuth, authorize('BUSINESS_OWNER', 'BUSINESS_STAFF', 'ADMIN'), slashStake);

export default router;
