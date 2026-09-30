import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const TIER_BOOSTS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 10,
  GOLD: 25,
  PLATINUM: 50,
};

const TIER_THRESHOLDS: Record<string, number> = {
  BRONZE: 100,
  SILVER: 1000,
  GOLD: 10000,
  PLATINUM: 100000,
};

export class PabStakingService {
  async getStakingTier(amountPab: number): Promise<string> {
    if (amountPab >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (amountPab >= TIER_THRESHOLDS.GOLD) return 'GOLD';
    if (amountPab >= TIER_THRESHOLDS.SILVER) return 'SILVER';
    return 'BRONZE';
  }

  async getTrustBoost(amountPab: number): Promise<number> {
    if (amountPab >= TIER_THRESHOLDS.PLATINUM) return TIER_BOOSTS.PLATINUM;
    if (amountPab >= TIER_THRESHOLDS.GOLD) return TIER_BOOSTS.GOLD;
    if (amountPab >= TIER_THRESHOLDS.SILVER) return TIER_BOOSTS.SILVER;
    return TIER_BOOSTS.BRONZE;
  }

  async getFeeDiscount(tier: string): Promise<number> {
    const discounts: Record<string, number> = {
      BRONZE: 0,
      SILVER: 0.10,
      GOLD: 0.25,
      PLATINUM: 0.50,
    };
    return discounts[tier] || 0;
  }

  async stake(userId: string, amountPab: number, durationDays: number) {
    const tier = await this.getStakingTier(amountPab);
    const trustBoost = await this.getTrustBoost(amountPab);
    const now = new Date();
    const unlockAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const position = await prisma.stakingRecord.create({
      data: {
        userId,
        tier,
        amountPab,
        trustBoost,
        status: 'ACTIVE',
        stakedAt: now,
        unlockAt,
      },
    });

    await prisma.pabWallet.update({
      where: { userId },
      data: {
        stakedAmt: { increment: amountPab },
        stakedTier: tier,
        stakedAt: now,
        stakeExpires: unlockAt,
      },
    });

    await prisma.pabTreasury.updateMany({
      data: { totalPabStaked: { increment: amountPab } },
    });

    logger.info(`[PabStaking] User ${userId} staked ${amountPab} PAB, tier=${tier}, boost=${trustBoost}`);

    return position;
  }

  async unstake(userId: string, stakingRecordId: string) {
    const record = await prisma.stakingRecord.findFirst({
      where: { id: stakingRecordId, userId, status: 'ACTIVE' },
    });

    if (!record) {
      throw new Error('Staking record not found or already unstaked');
    }

    const now = new Date();
    const isEarly = now < record.unlockAt;
    const penalty = isEarly ? record.amountPab * 0.1 : 0;
    const refundAmount = record.amountPab - penalty;

    await prisma.stakingRecord.update({
      where: { id: record.id },
      data: { status: 'UNSTAKED', unstakedAt: now },
    });

    await prisma.pabWallet.update({
      where: { userId },
      data: {
        stakedAmt: { decrement: record.amountPab },
        balance: { increment: refundAmount },
      },
    });

    if (penalty > 0) {
      await prisma.pabTreasury.updateMany({
        data: { totalPabBurned: { increment: penalty } },
      });

      await prisma.pabTransaction.create({
        data: {
          walletId: (await prisma.pabWallet.findUnique({ where: { userId } }))!.id,
          type: 'BURN',
          amount: penalty,
          action: 'early_unstake_penalty',
          description: `Early unstake penalty for ${record.amountPab} PAB`,
          balanceAfter: (await prisma.pabWallet.findUnique({ where: { userId } }))!.balance,
        },
      });
    }

    logger.info(`[PabStaking] User ${userId} unstaked ${record.amountPab} PAB, penalty=${penalty}`);

    return { refundAmount, penalty };
  }

  async getUserStaking(userId: string) {
    const records = await prisma.stakingRecord.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { stakedAt: 'desc' },
    });

    const totalStaked = records.reduce((sum, r) => sum + r.amountPab, 0);
    const tier = await this.getStakingTier(totalStaked);
    const trustBoost = await this.getTrustBoost(totalStaked);
    const feeDiscount = await this.getFeeDiscount(tier);

    return {
      records,
      totalStaked,
      tier,
      trustBoost,
      feeDiscount,
    };
  }

  async getTreasury() {
    return prisma.pabTreasury.findFirst();
  }
}

export const pabStakingService = new PabStakingService();
