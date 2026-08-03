/**
 * pabTokenStaking.service.ts
 * ────────────────────────────────────────────────────────────────────────────
 * $PAB token staking engine that feeds into the trust scoring system.
 *
 * Economic model:
 * - Users stake $PAB tokens → receive a trust score multiplier (1.0x → 2.5x)
 * - Multiplier reduces required escrow deposits on bookings
 * - No-shows slash a portion of staked tokens
 * - Completed bookings mint $PAB rewards based on trust tier
 *
 * Staking tiers (active staked $PAB):
 *   0–100    → 1.0x multiplier (baseline)
 *   100–500  → 1.3x multiplier
 *   500–2000 → 1.8x multiplier
 *   2000+    → 2.5x multiplier
 */
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { blockchainService } from './blockchain.service';

export interface StakePosition {
  userId: string;
  amount: number;
  tier: StakingTier;
  multiplier: number;
  totalRewarded: number;
  totalSlashed: number;
  lastRewardAt: Date | null;
}

export type StakingTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface StakeResult {
  success: boolean;
  userId: string;
  amount: number;
  tier: StakingTier;
  multiplier: number;
  totalStaked: number;
  estimatedDailyReward: number;
  txHash?: string;
  error?: string;
}

export interface UnstakeResult {
  success: boolean;
  userId: string;
  amount: number;
  multiplier: number;
  totalStaked: number;
  slashingPenalty: number;
  txHash?: string;
  error?: string;
}

export interface SlashResult {
  success: boolean;
  userId: string;
  reason: string;
  slashedAmount: number;
  remainingStake: number;
  newMultiplier: number;
}

export interface RewardResult {
  success: boolean;
  userId: string;
  rewardAmount: number;
  trigger: string;
  newTotalStaked: number;
  message: string;
}

// ── Staking Tier Configuration ──────────────────────────────────────────────

export const STAKING_TIERS: Record<StakingTier, { min: number; multiplier: number }> = {
  BRONZE:  { min: 0,    multiplier: 1.0 },
  SILVER:  { min: 100,  multiplier: 1.3 },
  GOLD:    { min: 500,  multiplier: 1.8 },
  PLATINUM:{ min: 2000, multiplier: 2.5 },
};

export const SLASH_RATES: Record<string, number> = {
  NO_SHOW: 0.15,       // 15% of stake slashed for no-show
  DISPUTE_LOST: 0.10,   // 10% slashed for losing a dispute
  FRAUD: 0.50,          // 50% slashed for confirmed fraud
  LATE_CANCELLATION: 0.05, // 5% slashed for late cancellation
};

export const REWARD_RATES: Record<string, number> = {
  COMPLETED_BOOKING: 0.5,     // $PAB per booking
  POSITIVE_REVIEW: 0.2,       // $PAB per verified review
  ON_TIME_RATE: 1.0,          // $PAB per 5-star booking
  STREAK_BONUS: 5.0,          // $PAB for 5 consecutive completions
};

export class PabTokenStakingService {

  /**
   * Calculate the staking tier and multiplier based on total active stake
   */
  getTier(totalStaked: number): { tier: StakingTier; multiplier: number } {
    let bestTier: StakingTier = 'BRONZE';
    let bestMultiplier = 1.0;

    for (const [tier, config] of Object.entries(STAKING_TIERS)) {
      if (totalStaked >= config.min && config.multiplier > bestMultiplier) {
        bestTier = tier as StakingTier;
        bestMultiplier = config.multiplier;
      }
    }

    return { tier: bestTier, multiplier: bestMultiplier };
  }

  /**
   * Calculate trust score multiplier from user's staked $PAB
   * Used by trustScoreService to boost scores for stakers
   */
  async getTrustMultiplier(userId: string): Promise<{ multiplier: number; totalStaked: number; tier: StakingTier }> {
    try {
      const activeStake = await prisma.stakingPosition.findMany({
        where: { userId, status: 'ACTIVE' },
      });

      const totalStaked = activeStake.reduce((sum, s) => sum + s.amount, 0);
      const { tier, multiplier } = this.getTier(totalStaked);

      return { multiplier, totalStaked, tier };
    } catch (error) {
      logger.warn('[PabStaking] Failed to compute multiplier for user', userId, error);
      return { multiplier: 1.0, totalStaked: 0, tier: 'BRONZE' };
    }
  }

  /**
   * Stake $PAB tokens for a user
   * In production: verifies on-chain transfer, then records in DB.
   * In dev/mock: records stake in DB (simulated).
   */
  async stakeTokens(userId: string, amount: number, txHash?: string): Promise<StakeResult> {
    if (amount <= 0) {
      return { success: false, userId, amount, tier: 'BRONZE', multiplier: 1.0, totalStaked: 0, estimatedDailyReward: 0, error: 'Amount must be positive' };
    }

    try {
      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { success: false, userId, amount, tier: 'BRONZE', multiplier: 1.0, totalStaked: 0, estimatedDailyReward: 0, error: 'User not found' };
      }

      // In production, verify on-chain transaction here
      // For now, simulate — record the stake
      const position = await prisma.stakingPosition.create({
        data: {
          userId,
          amount,
          status: 'ACTIVE',
        },
      });

      await prisma.stakeTransaction.create({
        data: {
          userId,
          amount,
          type: 'STAKE',
          apyAtTime: await this.getCurrentApy(),
        },
      });

      const totalStaked = await this.getTotalStaked(userId);
      const { tier, multiplier } = this.getTier(totalStaked);

      // If wallet address is on-chain, mint verification
      if (user.walletAddress) {
        await blockchainService.mintPabOnChain(
          user.walletAddress,
          amount,
          `stake:${position.id}`,
          'STAKE_CONFIRMED'
        );
      }

      const estimatedDailyReward = await this.estimateDailyReward(userId);

      logger.info(`[PabStaking] User ${userId} staked ${amount} $PAB → Tier: ${tier}, Multiplier: ${multiplier}x`);

      return {
        success: true,
        userId,
        amount,
        tier,
        multiplier,
        totalStaked,
        estimatedDailyReward,
        txHash,
      };
    } catch (error: any) {
      logger.error('[PabStaking] Stake failed:', error.message);
      return {
        success: false,
        userId,
        amount,
        tier: 'BRONZE',
        multiplier: 1.0,
        totalStaked: 0,
        estimatedDailyReward: 0,
        error: error.message,
      };
    }
  }

  /**
   * Unstake $PAB tokens (with potential slashing penalty)
   */
  async unstakeTokens(userId: string, positionId: string): Promise<UnstakeResult> {
    try {
      const position = await prisma.stakingPosition.findFirst({
        where: { id: positionId, userId, status: 'ACTIVE' },
      });

      if (!position) {
        return { success: false, userId, amount: 0, multiplier: 1.0, totalStaked: 0, slashingPenalty: 0, error: 'No active stake found' };
      }

      // Check for pending penalties (no-shows, disputes)
      const penalty = await this.computePendingPenalties(userId);
      const slashingPenalty = position.amount * penalty.rate;
      const netAmount = position.amount - slashingPenalty;

      // Close the position
      await prisma.stakingPosition.update({
        where: { id: positionId },
        data: { status: 'WITHDRAWN' },
      });

      await prisma.stakeTransaction.create({
        data: {
          userId,
          amount: netAmount,
          type: 'UNSTAKE',
          apyAtTime: await this.getCurrentApy(),
        },
      });

      // If there was a penalty, record it
      if (slashingPenalty > 0 && penalty.reason) {
        await prisma.stakeTransaction.create({
          data: {
            userId,
            amount: slashingPenalty,
            type: 'SLASH',
            apyAtTime: await this.getCurrentApy(),
          },
        });
        logger.warn(`[PabStaking] Penalized user ${userId}: ${slashingPenalty} $PAB slashed (${penalty.reason})`);
      }

      const totalStaked = await this.getTotalStaked(userId);
      const { tier, multiplier } = this.getTier(totalStaked);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } });

      if (user?.walletAddress && netAmount > 0) {
        // In production: return tokens on-chain
        await blockchainService.mintPabOnChain(
          user.walletAddress,
          netAmount,
          `unstake:${positionId}`,
          'UNSTAKE_RETURN'
        );
      }

      return {
        success: true,
        userId,
        amount: position.amount,
        multiplier,
        totalStaked,
        slashingPenalty,
        txHash: positionId,
      };
    } catch (error: any) {
      logger.error('[PabStaking] Unstake failed:', error.message);
      return {
        success: false,
        userId,
        amount: 0,
        multiplier: 1.0,
        totalStaked: 0,
        slashingPenalty: 0,
        error: error.message,
      };
    }
  }

  /**
   * Slash a user's stake for no-show, fraud, or dispute loss
   */
  async slashStake(userId: string, reason: keyof typeof SLASH_RATES, reservationId?: string): Promise<SlashResult> {
    const slashRate = SLASH_RATES[reason];
    if (slashRate === undefined) {
      return { success: false, userId, reason, slashedAmount: 0, remainingStake: 0, newMultiplier: 1.0 };
    }

    try {
      const activeStakes = await prisma.stakingPosition.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });

      if (activeStakes.length === 0) {
        return { success: false, userId, reason, slashedAmount: 0, remainingStake: 0, newMultiplier: 1.0 };
      }

      // Slash proportionally across all active positions
      let totalToSlash = 0;
      const updates: { id: string; newAmount: number }[] = [];

      for (const stake of activeStakes) {
        const portion = stake.amount * slashRate;
        const newAmount = stake.amount - portion;
        totalToSlash += portion;

        if (newAmount < 0.01) {
          updates.push({ id: stake.id, newAmount: 0 });
        } else {
          updates.push({ id: stake.id, newAmount });
        }
      }

      // Apply slashes
      for (const update of updates) {
        await prisma.stakingPosition.update({
          where: { id: update.id },
          data: {
            amount: update.newAmount,
            status: update.newAmount < 0.01 ? 'WITHDRAWN' : 'ACTIVE',
          },
        });

        if (update.newAmount < 0.01) {
          await prisma.stakeTransaction.create({
            data: {
              userId,
              amount: update.newAmount === 0 ? 0.01 : update.newAmount,
              type: 'SLASH',
              apyAtTime: await this.getCurrentApy(),
            },
          });
        }
      }

      const totalStaked = await this.getTotalStaked(userId);
      const { multiplier } = this.getTier(totalStaked);

      logger.warn(`[PabStaking] Slashed ${totalToSlash} $PAB from user ${userId} for ${reason}${reservationId ? ` (reservation: ${reservationId})` : ''}`);

      return {
        success: true,
        userId,
        reason,
        slashedAmount: totalToSlash,
        remainingStake: totalStaked,
        newMultiplier: multiplier,
      };
    } catch (error: any) {
      logger.error('[PabStaking] Slash failed:', error.message);
      return { success: false, userId, reason, slashedAmount: 0, remainingStake: 0, newMultiplier: 1.0 };
    }
  }

  /**
   * Reward a user for completing a booking, positive review, etc.
   */
  async rewardUser(userId: string, trigger: keyof typeof REWARD_RATES, referenceId?: string): Promise<RewardResult> {
    const rewardRate = REWARD_RATES[trigger];
    if (rewardRate === undefined) {
      return { success: false, userId, rewardAmount: 0, trigger, newTotalStaked: 0, message: 'Unknown trigger' };
    }

    try {
      // First, get the user's trust multiplier for boosted rewards
      const { multiplier } = await this.getTrustMultiplier(userId);

      // Base reward × multiplier (capped at 3x total)
      let rewardAmount = rewardRate * Math.min(3, multiplier);

      // Check if user has a streak bonus
      const recentCompletions = await this.getRecentCompletedBookings(userId, 7);
      if (trigger === 'COMPLETED_BOOKING' && recentCompletions >= 5) {
        rewardAmount += REWARD_RATES.STREAK_BONUS;
      }

      rewardAmount = Number(rewardAmount.toFixed(8));

      // Record the reward as a stake transaction (mint)
      await prisma.stakeTransaction.create({
        data: {
          userId,
          amount: rewardAmount,
          type: 'REWARD',
          apyAtTime: await this.getCurrentApy(),
        },
      });

      // Add reward to staking position (compound)
      const activePosition = await prisma.stakingPosition.findFirst({
        where: { userId, status: 'ACTIVE' },
      });

      if (activePosition) {
        await prisma.stakingPosition.update({
          where: { id: activePosition.id },
          data: { amount: { increment: rewardAmount } },
        });
      } else {
        // Create a new position for the reward
        await prisma.stakingPosition.create({
          data: { userId, amount: rewardAmount, status: 'ACTIVE' },
        });
      }

      const totalStaked = await this.getTotalStaked(userId);
      const { tier } = this.getTier(totalStaked);

      // Mint on-chain if wallet exists
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletAddress: true } });
      if (user?.walletAddress) {
        await blockchainService.mintPabOnChain(
          user.walletAddress,
          rewardAmount,
          `reward:${trigger}:${referenceId || ''}`,
          'REWARD_MINT'
        );
      }

      logger.info(`[PabStaking] Rewarded user ${userId}: ${rewardAmount} $PAB for ${trigger}`);

      return {
        success: true,
        userId,
        rewardAmount,
        trigger,
        newTotalStaked: totalStaked,
        message: `Earned ${rewardAmount} $PAB (${tier} tier, ${multiplier.toFixed(1)}x multiplier)${recentCompletions >= 5 ? ' + streak bonus!' : ''}`,
      };
    } catch (error: any) {
      logger.error('[PabStaking] Reward failed:', error.message);
      return { success: false, userId, rewardAmount: 0, trigger, newTotalStaked: 0, message: error.message };
    }
  }

  /**
   * Apply the trust multiplier to reduce a user's deposit requirement
   */
  async getEffectiveDeposit(userId: string, baseDeposit: number): Promise<{
    effectiveDeposit: number;
    multiplier: number;
    tier: StakingTier;
    totalStaked: number;
  }> {
    const { multiplier, totalStaked, tier } = await this.getTrustMultiplier(userId);
    const effectiveDeposit = Math.max(0, baseDeposit / multiplier);

    return {
      effectiveDeposit: Number(effectiveDeposit.toFixed(2)),
      multiplier,
      tier,
      totalStaked,
    };
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async getTotalStaked(userId: string): Promise<number> {
    const result = await prisma.stakingPosition.aggregate({
      where: { userId, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  }

  private async getCurrentApy(): Promise<number> {
    // Fixed APY — in production this could be dynamic based on protocol revenue
    return 0.12; // 12% APY on staked $PAB
  }

  private async estimateDailyReward(userId: string): Promise<number> {
    const totalStaked = await this.getTotalStaked(userId);
    const apy = await this.getCurrentApy();
    return Number((totalStaked * apy / 365).toFixed(8));
  }

  private async getRecentCompletedBookings(userId: string, days: number): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const count = await prisma.reservation.count({
      where: {
        customerId: userId,
        status: 'COMPLETED',
        createdAt: { gte: since },
      },
    });

    return count;
  }

  private async computePendingPenalties(userId: string): Promise<{ rate: number; reason?: string }> {
    // Check recent no-shows in the last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const recentNoShows = await prisma.reservation.count({
      where: {
        customerId: userId,
        status: 'NO_SHOW',
        createdAt: { gte: since },
      },
    });

    if (recentNoShows > 0) {
      return { rate: SLASH_RATES.NO_SHOW, reason: 'recent_no_show' };
    }

    // Check lost disputes (where the user filed the dispute but it was dismissed)
    const lostDisputes = await prisma.dispute.count({
      where: {
        reportedById: userId,
        outcome: 'DISMISSED',
        createdAt: { gte: since },
      },
    });

    if (lostDisputes > 0) {
      return { rate: SLASH_RATES.DISPUTE_LOST, reason: 'lost_dispute' };
    }

    return { rate: 0 };
  }
}

export const pabTokenStakingService = new PabTokenStakingService();
