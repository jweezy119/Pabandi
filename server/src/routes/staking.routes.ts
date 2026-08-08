import { Router, Request, Response } from 'express';
import { pabTokenStakingService } from '../services/pabTokenStaking.service';
import { trustArbitratorService } from '../services/trustArbitrator.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ── $PAB Staking Routes ──────────────────────────────────────────

/**
 * POST /api/v1/staking/stake
 * Stake $PAB tokens to earn trust score multipliers.
 *
 * Body: { amount: number, txHash?: string }
 * Returns: { success, userId, amount, tier, multiplier, totalStaked, estimatedDailyReward }
 */
router.post('/stake', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const amount = Number(req.body.amount);
  const txHash = req.body.txHash;

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid amount is required' });
  }

  try {
    const result = await pabTokenStakingService.stakeTokens(req.user!.id, amount, txHash);
    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    logger.error('[Staking] /stake error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/staking/unstake
 * Unstake $PAB tokens (may incur slashing penalty).
 *
 * Body: { positionId: string }
 * Returns: { success, userId, amount, multiplier, totalStaked, slashingPenalty }
 */
router.post('/unstake', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  const { positionId } = req.body;

  if (!positionId) {
    return res.status(400).json({ success: false, error: 'positionId is required' });
  }

  try {
    const result = await pabTokenStakingService.unstakeTokens(req.user!.id, positionId);
    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    logger.error('[Staking] /unstake error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/staking/positions
 * Get all staking positions for the authenticated user.
 */
router.get('/positions', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const positions = await prisma.stakingPosition.findMany({
      where: { userId: req.user!.id },
    });

    const { multiplier, totalStaked, tier } = await pabTokenStakingService.getTrustMultiplier(req.user!.id);
    const estimatedDailyReward = Number((totalStaked * 0.12 / 365).toFixed(8));

    return res.json({
      success: true,
      data: {
        positions,
        totalStaked,
        tier,
        multiplier,
        estimatedDailyReward,
      },
    });
  } catch (error: any) {
    logger.error('[Staking] /positions error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/staking/multiplier/:userId
 * Public endpoint to check a user's staking multiplier.
 */
router.get('/multiplier/:userId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { multiplier, totalStaked, tier } = await pabTokenStakingService.getTrustMultiplier(req.params.userId);
    return res.json({
      success: true,
      data: { multiplier, totalStaked, tier },
    });
  } catch (error: any) {
    logger.error('[Staking] /multiplier error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/staking/deposit-multiplier/:userId
 * Get the effective deposit after applying the staking multiplier.
 */
router.get('/deposit-multiplier/:userId', async (req: Request, res: Response): Promise<any> => {
  const baseDeposit = Number(req.query.baseDeposit || 10);
  try {
    const result = await pabTokenStakingService.getEffectiveDeposit(req.params.userId, baseDeposit);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Staking] /deposit-multiplier error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/staking/me/earnings
 * Get user's wallet balance, trust multiplier, and recent minting history.
 */
router.get('/me/earnings', authenticate, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user!.id;
    
    // 1. Get Wallet Balance
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.wallet.create({ data: { userId, balance: 0 } });
    }

    // 2. Get Trust Multiplier & Velocity
    const { trustFluxService } = await import('../services/trustFlux.service');
    
    const flux = await trustFluxService.computeTrustFlux(userId);
    const { multiplier, tier, totalStaked } = await pabTokenStakingService.getTrustMultiplier(userId);
    
    // Compute the current velocity multiplier they would get if they minted today
    const MIN_VELOCITY_MULT = 0.5;
    const MAX_VELOCITY_MULT = 2.0;
    const velocityMult = MIN_VELOCITY_MULT + ((flux.velocity + 1) / 2) * (MAX_VELOCITY_MULT - MIN_VELOCITY_MULT);

    // 3. Get Recent Earnings History
    const history = await prisma.trustAuditTrail.findMany({
      where: { 
        userId, 
        changeReason: { startsWith: 'PABOND_MINT_' } 
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.json({
      success: true,
      data: {
        balancePAB: wallet.balance,
        totalStaked,
        tier,
        stakingMultiplier: multiplier,
        trustVelocity: Math.round(flux.velocity * 1000) / 1000,
        velocityMultiplier: Math.round(velocityMult * 1000) / 1000,
        history
      }
    });
  } catch (error: any) {
    logger.error('[Staking] /me/earnings error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── AI Trust Arbitrator Routes ───────────────────────────────────

/**
 * POST /api/v1/arbitrator/dispute
 * Submit a dispute for AI arbitration.
 *
 * Body: DisputeEvidence
 * Returns: { success, data: ArbitrationResult }
 */
router.post('/arbitrator/dispute', async (req: Request, res: Response): Promise<any> => {
  const evidence = req.body as Record<string, unknown>;

  if (!evidence.disputeId || !evidence.claimAmount || !evidence.bookingDetails) {
    return res.status(400).json({
      success: false,
      error: 'disputeId, claimAmount, and bookingDetails are required',
    });
  }

  try {
    const result = await trustArbitratorService.arbitrate(evidence as any);

    // Record the arbitration result
    const disputeUpdate: Record<string, unknown> = {
      outcome: result.needsHumanReview ? 'PENDING' : 'RESOLVED',
      stakedAmount: Number(result.pabSlash?.amount || 0),
      evidenceUrls: result.pabSlash ? [JSON.stringify(result.pabSlash)] : [],
    };

    await prisma.dispute.update({
      where: { id: evidence.disputeId as string },
      data: disputeUpdate,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[Arbitrator] /dispute error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/arbitrator/tiers
 * Get staking tier configuration for $PAB trust multipliers.
 */
router.get('/arbitrator/tiers', (_req: Request, res: Response): any => {
  return res.json({
    success: true,
    data: {
      tiers: {
        BRONZE:  { min: 0,    multiplier: 1.0 },
        SILVER:  { min: 100,  multiplier: 1.3 },
        GOLD:    { min: 500,  multiplier: 1.8 },
        PLATINUM:{ min: 2000, multiplier: 2.5 },
      },
      slashRates: {
        NO_SHOW: 0.15,
        DISPUTE_LOST: 0.10,
        FRAUD: 0.50,
        LATE_CANCELLATION: 0.05,
      },
      rewardRates: {
        COMPLETED_BOOKING: 0.5,
        POSITIVE_REVIEW: 0.2,
        ON_TIME_RATE: 1.0,
        STREAK_BONUS: 5.0,
      },
      humanEscalationThresholdUSD: 500,
      highConfidenceThreshold: 0.85,
    },
  });
});

/**
 * GET /api/v1/staking/pabond/stats
 * Returns Pabond bonding curve statistics: price, APY, TVL, daily volume,
 * top 10 velocity leaders. Public endpoint.
 */
router.get('/pabond/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { pabondService } = await import('../services/pabond.service');
    const stats = await pabondService.getStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    logger.error(`[StakingRoutes] pabond/stats error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
