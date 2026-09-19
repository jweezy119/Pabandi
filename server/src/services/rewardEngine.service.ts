import { prisma } from '../utils/database';

// Base reward rates
const CUSTOMER_REWARD_RATE = 0.10;  // 10% of purchase
const BUSINESS_REWARD_RATE = 0.05;  // 5% of purchase
const REFERRAL_REWARD_RATE = 0.02;  // 2% of referee's purchase

// PAB token price (fetch from oracle or use fixed for now)
const PAB_PRICE_USD = 0.10; // $0.10 per PAB

export interface RewardCalculation {
  customerRewardUsd: number;
  businessRewardUsd: number;
  customerRewardPab: number;
  businessRewardPab: number;
  tierMultiplier: number;
}

export interface IssueRewardsParams {
  customerId: string;
  businessId: string;
  purchaseAmount: number;
  referenceId: string;
  referenceType: string;
}

export interface FeeOffsetResult {
  offsetAmount: number;
  offsetUsdValue: number;
  finalFee: number;
  discountPercent?: number;
}

export interface UserRewardTier {
  name: string;
  feeDiscount: number;
  rewardMultiplier: number;
}

export class RewardEngine {
  /**
   * Calculate rewards for a purchase
   */
  calculateRewards(purchaseAmountUsd: number, tierMultiplier: number = 1.0): RewardCalculation {
    const customerReward = purchaseAmountUsd * CUSTOMER_REWARD_RATE * tierMultiplier;
    const businessReward = purchaseAmountUsd * BUSINESS_REWARD_RATE * tierMultiplier;
    return {
      customerRewardUsd: customerReward,
      businessRewardUsd: businessReward,
      customerRewardPab: customerReward / PAB_PRICE_USD,
      businessRewardPab: businessReward / PAB_PRICE_USD,
      tierMultiplier,
    };
  }

  /**
   * Issue rewards after a confirmed payment
   */
  async issueRewards(params: IssueRewardsParams) {
    const { customerId, businessId, purchaseAmount, referenceId, referenceType } = params;

    // Get user tiers for multipliers
    const customerTier = await this.getUserTier(customerId, 'CUSTOMER');
    const businessTier = await this.getUserTier(businessId, 'BUSINESS');

    const rewards = this.calculateRewards(purchaseAmount, customerTier.rewardMultiplier);

    // Create reward transactions
    const customerReward = await prisma.rewardTransaction.create({
      data: {
        userId: customerId,
        userType: 'CUSTOMER',
        type: 'PURCHASE_REWARD',
        amount: rewards.customerRewardPab,
        usdValue: rewards.customerRewardUsd,
        referenceId,
        referenceType,
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    const businessReward = await prisma.rewardTransaction.create({
      data: {
        userId: businessId,
        userType: 'BUSINESS',
        type: 'PURCHASE_REWARD',
        amount: rewards.businessRewardPab,
        usdValue: rewards.businessRewardUsd,
        referenceId,
        referenceType,
        status: 'CLAIMED',
        claimedAt: new Date(),
      },
    });

    // Update balances
    await this.updateBalance(customerId, 'CUSTOMER', rewards.customerRewardPab);
    await this.updateBalance(businessId, 'BUSINESS', rewards.businessRewardPab);

    return { customerReward, businessReward, rewards };
  }

  /**
   * Calculate fee offset using staked $PAB
   */
  async calculateFeeOffset(userId: string, userType: string, originalFeeUsd: number): Promise<FeeOffsetResult> {
    const balance = await prisma.userRewardBalance.findUnique({ where: { userId } });
    if (!balance || balance.stakedAmount === 0) {
      return { offsetAmount: 0, offsetUsdValue: 0, finalFee: originalFeeUsd };
    }

    const tier = await this.getUserTier(userId, userType);
    const discount = tier.feeDiscount;
    const offsetUsd = originalFeeUsd * (discount / 100);
    const offsetPab = offsetUsd / PAB_PRICE_USD;

    return {
      offsetAmount: offsetPab,
      offsetUsdValue: offsetUsd,
      finalFee: originalFeeUsd - offsetUsd,
      discountPercent: discount,
    };
  }

  /**
   * Get user's reward tier
   */
  async getUserTier(userId: string, userType: string): Promise<UserRewardTier> {
    const balance = await prisma.userRewardBalance.findUnique({ where: { userId } });
    const staked = balance?.stakedAmount || 0;

    const tier = await prisma.rewardTier.findFirst({
      where: { minStake: { lte: staked }, isActive: true },
      orderBy: { minStake: 'desc' },
    });

    return tier ? { name: tier.name, feeDiscount: tier.feeDiscount, rewardMultiplier: tier.rewardMultiplier } : { name: 'Bronze', feeDiscount: 0, rewardMultiplier: 1.0 };
  }

  /**
   * Update user's reward balance
   */
  async updateBalance(userId: string, userType: string, amountDelta: number) {
    return prisma.userRewardBalance.upsert({
      where: { userId },
      create: {
        userId,
        userType,
        totalEarned: amountDelta,
        totalClaimed: amountDelta,
      },
      update: {
        totalEarned: { increment: amountDelta },
        totalClaimed: { increment: amountDelta },
      },
    });
  }

  /**
   * Seed default reward tiers
   */
  async seedTiers() {
    const tiers = [
      { name: 'Bronze', minStake: 0, feeDiscount: 0, rewardMultiplier: 1.0, color: '#CD7F32', icon: '🥉' },
      { name: 'Silver', minStake: 100, feeDiscount: 10, rewardMultiplier: 1.25, color: '#C0C0C0', icon: '🥈' },
      { name: 'Gold', minStake: 500, feeDiscount: 25, rewardMultiplier: 1.5, color: '#FFD700', icon: '🥇' },
      { name: 'Platinum', minStake: 2000, feeDiscount: 50, rewardMultiplier: 2.0, color: '#E5E4E2', icon: '💎' },
    ];

    for (const tier of tiers) {
      await prisma.rewardTier.upsert({
        where: { name: tier.name },
        create: tier,
        update: tier,
      });
    }
  }
}

export const rewardEngine = new RewardEngine();
