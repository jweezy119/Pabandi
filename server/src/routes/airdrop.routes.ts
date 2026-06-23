import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getAirdropStats, getEligibility, claimAirdrop } from '../controllers/airdrop.controller';

const router = Router();

// Public - anyone can check the stats
router.get('/stats', getAirdropStats);

// Protected - must be logged in
router.get('/eligibility', authenticate, getEligibility);
router.post('/claim', authenticate, claimAirdrop);

export default router;
