import { Router, Request, Response } from 'express';
import { agentRewardService } from '../services/agentReward.service';
import { authenticate } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/agent-rewards/distribute
 * Distribute PAB reward to agent for completed task
 * Body: { agentId: string, taskType: string, taskValue: number }
 */
router.post('/distribute', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { agentId, taskType, taskValue } = req.body;

  if (!agentId || !taskType || !taskValue) {
    return res.status(400).json({ success: false, error: 'agentId, taskType, and taskValue are required' });
  }

  if (typeof taskValue !== 'number' || taskValue <= 0) {
    return res.status(400).json({ success: false, error: 'taskValue must be a positive number' });
  }

  try {
    const result = await agentRewardService.distributeAgentReward({
      agentId,
      taskType,
      taskValue,
      userId: req.user!.id,
    });
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    logger.error('[AgentRewardRoutes] /distribute error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agent-rewards/:agentId
 * Get all rewards for an agent
 */
router.get('/:agentId', async (req: Request, res: Response): Promise<any> => {
  try {
    const result = await agentRewardService.getAgentRewards(req.params.agentId);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[AgentRewardRoutes] /:agentId error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agent-rewards/user/me
 * Get current user's rewards
 */
router.get('/user/me', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const result = await agentRewardService.getUserRewards(req.user!.id);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[AgentRewardRoutes] /user/me error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/agent-rewards/config/rates
 * Get reward rate configuration (public)
 */
router.get('/config/rates', async (_req: Request, res: Response): Promise<any> => {
  return res.json({
    success: true,
    data: {
      rewardRate: agentRewardService.REWARD_RATE,
      rewardPercent: `${agentRewardService.REWARD_RATE * 100}%`,
      description: 'Agents earn 2% of task value in PAB',
    },
  });
});

export default router;
