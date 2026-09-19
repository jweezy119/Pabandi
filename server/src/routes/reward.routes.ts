import { Router } from 'express';
import { getRewardBalance, getRewardHistory, getRewardTiers, calculateRewards, getFeeOffset } from '../controllers/reward.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/balance', authenticate, getRewardBalance);
router.get('/history', authenticate, getRewardHistory);
router.get('/tiers', getRewardTiers);
router.post('/calculate', calculateRewards);
router.post('/fee-offset', authenticate, getFeeOffset);

export default router;
