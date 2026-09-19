import { Request, Response, NextFunction } from 'express';
import { rewardEngine } from '../services/rewardEngine.service';
import { prisma } from '../utils/database';

export const getRewardBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const balance = await prisma.userRewardBalance.findUnique({ where: { userId } });
    const tier = await rewardEngine.getUserTier(userId, balance?.userType || 'CUSTOMER');
    
    res.json({
      success: true,
      balance: balance || { totalEarned: 0, totalClaimed: 0, currentTier: 'Bronze', stakedAmount: 0 },
      tier,
    });
  } catch (err) {
    next(err);
  }
};

export const getRewardHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const history = await prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
};

export const getRewardTiers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tiers = await prisma.rewardTier.findMany({
      where: { isActive: true },
      orderBy: { minStake: 'asc' },
    });
    res.json({ success: true, tiers });
  } catch (err) {
    next(err);
  }
};

export const calculateRewards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { purchaseAmount } = req.body;
    const userId = (req as any).user?.id;
    
    let multiplier = 1.0;
    if (userId) {
      const tier = await rewardEngine.getUserTier(userId, 'CUSTOMER');
      multiplier = tier.rewardMultiplier || 1.0;
    }

    const rewards = rewardEngine.calculateRewards(purchaseAmount, multiplier);
    res.json({ success: true, rewards });
  } catch (err) {
    next(err);
  }
};

export const getFeeOffset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { originalFee } = req.body;
    const balance = await prisma.userRewardBalance.findUnique({ where: { userId } });
    const offset = await rewardEngine.calculateFeeOffset(userId, balance?.userType || 'CUSTOMER', originalFee);
    
    res.json({ success: true, offset });
  } catch (err) {
    next(err);
  }
};
