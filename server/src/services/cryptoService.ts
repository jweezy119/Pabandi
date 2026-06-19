import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

/** $PAB reward amounts — aligned with public marketing copy */
export const PAB_REWARD_RULES = {
  customer: {
    CHECK_IN: 50,
    GOOGLE_REVIEW: 200,
    REFERRAL: 100,
    STREAK_BONUS: 25,
  },
  business: {
    HONORED_BOOKING: 25,
    NO_SHOW_DEPOSIT_KEPT: 40,
    LOW_NO_SHOW_MONTH: 75,
    CUSTOMER_REFERRAL: 150,
    PAYOUT_TO_SOLANA: true,
  },
} as const;

export type RewardType =
  | 'RESERVATION_COMPLETION'
  | 'GOOGLE_REVIEW'
  | 'REFERRAL'
  | 'STREAK_BONUS'
  | 'BUSINESS_RESERVATION_HONORED'
  | 'BUSINESS_NO_SHOW_PROTECTED'
  | 'BUSINESS_RELIABILITY_BONUS'
  | 'BUSINESS_REFERRAL';

export class CryptoService {
  private async creditPab(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string,
    amount: number,
    type: RewardType,
    reservationId?: string,
    metadata?: any
  ) {
    await tx.cryptoReward.create({
      data: {
        userId,
        reservationId,
        amount,
        type,
        status: 'CLAIMABLE',
        metadata: metadata || null,
      },
    });

    await tx.wallet.upsert({
      where: { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount, currency: 'PAB' },
    });
  }

  /**
   * Reward customer for completing a reservation (verified check-in).
   */
  async rewardReservationCompletion(userId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { riskScore: true, customer: { select: { reliabilityScore: true } } }
      });
      if (!reservation) return;

      let amount: number = PAB_REWARD_RULES.customer.CHECK_IN; // 50 base

      // 1. Reliability Multiplier
      const rScore = reservation.customer.reliabilityScore || 100;
      const reliabilityMultiplier = rScore / 100.0; // 0.0 to 1.0

      // 2. Proving AI Wrong Bonus
      const aiRisk = reservation.riskScore || 0;
      let aiBonus = 0;
      if (aiRisk >= 60) {
        // High risk but showed up! Give them up to 50% extra base reward
        aiBonus = PAB_REWARD_RULES.customer.CHECK_IN * ((aiRisk - 60) / 100.0) * 2; 
      }

      amount = Math.floor((amount * reliabilityMultiplier) + aiBonus);

      logger.info(`PAB +${amount} customer ${userId} reservation ${reservationId} (Base: ${PAB_REWARD_RULES.customer.CHECK_IN}, R-Score: ${rScore}, AI-Risk: ${aiRisk}, AI Bonus: ${aiBonus})`);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.cryptoReward.findFirst({
          where: { userId, reservationId, type: 'RESERVATION_COMPLETION' },
        });
        if (existing) return;

        await this.creditPab(tx, userId, amount, 'RESERVATION_COMPLETION', reservationId, {
          baseAmount: PAB_REWARD_RULES.customer.CHECK_IN,
          reliabilityMultiplier,
          aiBonus
        });
        await tx.reservation.update({
          where: { id: reservationId },
          data: { rewardEarned: { increment: amount } },
        });
      });
    } catch (error) {
      logger.error('Error rewarding reservation completion:', error);
      throw error;
    }
  }

  /**
   * Reward business owner when they honor a completed booking.
   */
  async rewardBusinessForCompletion(businessId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { riskScore: true }
      });
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, ownerId: true },
      });
      if (!business) return;

      let amount: number = PAB_REWARD_RULES.business.HONORED_BOOKING; // 25 base
      
      // Risk Acceptance Bonus for Business
      const aiRisk = reservation?.riskScore || 0;
      let aiBonus = 0;
      if (aiRisk >= 60) {
        // Business took a chance on a high risk user and it paid off
        aiBonus = PAB_REWARD_RULES.business.HONORED_BOOKING * ((aiRisk - 50) / 100.0) * 1.5;
      }
      
      amount = Math.floor(amount + aiBonus);

      logger.info(`PAB +${amount} business owner ${business.ownerId} reservation ${reservationId} (Base: ${PAB_REWARD_RULES.business.HONORED_BOOKING}, AI-Risk: ${aiRisk}, Risk Bonus: ${aiBonus})`);

      await prisma.$transaction(async (tx) => {
        if (business.ownerId) {
          try {
            const existingBusinessReward = await tx.cryptoReward.findFirst({
              where: { userId: business.ownerId, reservationId, type: 'BUSINESS_RESERVATION_HONORED' },
            });

            if (!existingBusinessReward) {
              await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_RESERVATION_HONORED', reservationId, {
                baseAmount: PAB_REWARD_RULES.business.HONORED_BOOKING,
                aiRisk,
                aiBonus
              });
            }
          } catch (err) {
            console.error(`Failed to reward business ${business.id}:`, err);
          }
        }
      });
    } catch (error) {
      logger.error('Error rewarding business completion:', error);
      throw error;
    }
  }

  /**
   * Reward business when a no-show occurs and deposit protection applies.
   */
  async rewardBusinessNoShowProtected(businessId: string, reservationId: string): Promise<void> {
    try {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { depositRequired: true, depositStatus: true },
      });
      if (!reservation?.depositRequired) return;

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerId: true },
      });
      if (!business) return;

      const amount = PAB_REWARD_RULES.business.NO_SHOW_DEPOSIT_KEPT;
      logger.info(`PAB +${amount} business no-show protection ${businessId}`);

      await prisma.$transaction(async (tx) => {
        if (business.ownerId) {
          const existing = await tx.cryptoReward.findFirst({
            where: { userId: business.ownerId, reservationId, type: 'BUSINESS_NO_SHOW_PROTECTED' },
          });
          if (existing) return;

          await this.creditPab(tx, business.ownerId, amount, 'BUSINESS_NO_SHOW_PROTECTED', reservationId);
        }
      });
    } catch (error) {
      logger.error('Error rewarding business no-show protection:', error);
      throw error;
    }
  }

  /**
   * Reward user for leaving a Google review.
   */
  async rewardGoogleReview(userId: string, _businessId: string, _googleReviewId: string): Promise<void> {
    try {
      const amount = PAB_REWARD_RULES.customer.GOOGLE_REVIEW;
      logger.info(`PAB +${amount} review reward user ${userId}`);

      await prisma.$transaction(async (tx) => {
        await this.creditPab(tx, userId, amount, 'GOOGLE_REVIEW');
      });
    } catch (error) {
      logger.error('Error rewarding Google review:', error);
      throw error;
    }
  }

  /**
   * Connect or update Solana (Phantom) wallet for payouts.
   */
  async connectSolanaWallet(userId: string, address: string) {
    return prisma.wallet.upsert({
      where: { userId },
      update: { address, currency: 'SOL' },
      create: { userId, address, balance: 0, currency: 'SOL' },
    });
  }

  /**
   * Get wallet + recent rewards for any user.
   */
  async getWalletData(userId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const rewards = await prisma.cryptoReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        reservation: {
          select: {
            id: true,
            business: { select: { name: true } },
          },
        },
      },
    });

    const totalEarned = await prisma.cryptoReward.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    return {
      balance: wallet?.balance || 0,
      currency: 'PAB',
      solanaAddress: wallet?.currency === 'SOL' ? wallet.address : wallet?.address,
      chain: wallet?.currency === 'SOL' ? 'solana' : wallet?.address ? 'other' : null,
      totalEarned: totalEarned._sum.amount || 0,
      recentRewards: rewards.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        metadata: r.metadata,
        businessName: r.reservation?.business?.name,
        reservationId: r.reservationId,
      })),
    };
  }

  /**
   * Business owner: PAB earnings breakdown and Solana payout readiness.
   */
  async getBusinessRewardsSummary(ownerId: string) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: ownerId } });
    const businessRewards = await prisma.cryptoReward.findMany({
      where: {
        userId: ownerId,
        type: { startsWith: 'BUSINESS_' },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const byType = await prisma.cryptoReward.groupBy({
      by: ['type'],
      where: { userId: ownerId, type: { startsWith: 'BUSINESS_' } },
      _sum: { amount: true },
      _count: true,
    });

    const totalBusinessPab = byType.reduce((sum, row) => sum + (row._sum.amount || 0), 0);

    return {
      balance: wallet?.balance || 0,
      currency: 'PAB',
      totalBusinessPab,
      solanaConnected: !!(wallet?.address && wallet.currency === 'SOL'),
      solanaAddress: wallet?.currency === 'SOL' ? wallet.address : null,
      rules: PAB_REWARD_RULES.business,
      breakdown: byType.map((row) => ({
        type: row.type,
        count: row._count,
        total: row._sum.amount || 0,
      })),
      recentRewards: businessRewards,
    };
  }

  getPublicRewardRules() {
    return PAB_REWARD_RULES;
  }
}

export const cryptoService = new CryptoService();
