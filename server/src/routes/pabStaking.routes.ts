import { Router, Request, Response } from 'express';
import { pabStakingService } from '../services/pabStaking.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/v1/pab-staking/stake
 * Stake PAB tokens to boost trust score
 * Body: { tier: 'SILVER' | 'GOLD' | 'PLATINUM' }
 */
router.post('/stake', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { tier } = req.body;

  if (!tier || !['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
    return res.status(400).json({ success: false, error: 'Valid tier required: BRONZE, SILVER, GOLD, or PLATINUM' });
  }

  try {
    const result = await pabStakingService.stakePab(req.user!.id, tier);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('[PabStakingRoutes] /stake error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/pab-staking/unstake
 * Unstake PAB after lock period
 * Body: { stakingId: string }
 */
router.post('/unstake', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { stakingId } = req.body;

  if (!stakingId) {
    return res.status(400).json({ success: false, error: 'stakingId is required' });
  }

  try {
    const result = await pabStakingService.unstakePab(req.user!.id, stakingId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('[PabStakingRoutes] /unstake error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/pab-staking/status
 * Get user's staking status and tiers
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const status = await pabStakingService.getStakingStatus(req.user!.id);
    return res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error('[PabStakingRoutes] /status error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/pab-staking/tiers
 * Get available staking tiers (public)
 */
router.get('/tiers', async (_req: Request, res: Response): Promise<any> => {
  return res.json({
    success: true,
    data: pabStakingService.STAKE_TIERS,
  });
});

export default router;
