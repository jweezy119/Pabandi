import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const partnerRewardsService = {
  // ── Partner Enrollment ───────────────────────────────────────────────────
  
  async enrollBusiness(businessId: string, commissionRate: number = 0.02) {
    return prisma.partnerEnrollment.upsert({
      where: { businessId },
      update: { status: 'ACTIVE', commissionRate },
      create: {
        businessId,
        status: 'ACTIVE',
        commissionRate,
      },
    });
  },

  async getEnrollment(businessId: string) {
    return prisma.partnerEnrollment.findUnique({ where: { businessId } });
  },

  async listEnrolledBusinesses() {
    return prisma.partnerEnrollment.findMany({
      where: { status: 'ACTIVE' },
      include: { business: true },
    });
  },

  // ── Offer Management ─────────────────────────────────────────────────────
  
  async createOffer(data: {
    businessId: string;
    title: string;
    description: string;
    category: string;
    rewardType: string;
    rewardValue: number;
    maxRewardAmount?: number;
    minPurchase?: number;
    maxRedemptions?: number;
    perUserLimit?: number;
    startsAt: Date;
    endsAt: Date;
  }) {
    return prisma.partnerOffer.create({
      data: {
        ...data,
        active: true,
        totalRedeemed: 0,
      },
    });
  },

  async updateOffer(id: string, data: Partial<{
    title: string;
    description: string;
    active: boolean;
    maxRedemptions: number;
  }>) {
    return prisma.partnerOffer.update({
      where: { id },
      data,
    });
  },

  async listOffers(params?: { businessId?: string; category?: string; active?: boolean }) {
    const where: any = {};
    if (params?.businessId) where.businessId = params.businessId;
    if (params?.category) where.category = params.category;
    if (params?.active !== undefined) where.active = params.active;
    
    return prisma.partnerOffer.findMany({
      where,
      include: { business: { select: { id: true, name: true, address: true, logoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getOffer(id: string) {
    return prisma.partnerOffer.findUnique({
      where: { id },
      include: { business: true },
    });
  },

  // ── User Rewards ─────────────────────────────────────────────────────────
  
  async redeemOffer(userId: string, offerId: string) {
    const offer = await prisma.partnerOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error('Offer not found');
    if (!offer.active) throw new Error('Offer is not active');
    if (offer.totalRedeemed >= offer.maxRedemptions) throw new Error('Offer fully redeemed');
    
    // Check per-user limit
    const userRedemptions = await prisma.userReward.count({
      where: { userId, offerId },
    });
    if (userRedemptions >= offer.perUserLimit) {
      throw new Error('You have already redeemed this offer');
    }

    // Generate redemption code
    const redemptionCode = `RWD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    return prisma.userReward.create({
      data: {
        userId,
        offerId,
        status: 'PENDING',
        redemptionCode,
        rewardEarned: 0,
      },
    });
  },

  async confirmRedemption(userId: string, redemptionCode: string, purchaseAmount: number) {
    const reward = await prisma.userReward.findFirst({
      where: { userId, redemptionCode },
      include: { offer: true },
    });
    
    if (!reward) throw new Error('Redemption not found');
    if (reward.status === 'REDEEMED') throw new Error('Already redeemed');
    
    // Calculate reward
    let rewardEarned = 0;
    const offer = reward.offer;
    
    switch (offer.rewardType) {
      case 'PERCENTAGE_OFF':
        rewardEarned = purchaseAmount * (offer.rewardValue / 100);
        break;
      case 'FIXED_OFF':
        rewardEarned = offer.rewardValue;
        break;
      case 'CASHBACK_PAB':
        rewardEarned = purchaseAmount * (offer.rewardValue / 100);
        if (offer.maxRewardAmount && rewardEarned > offer.maxRewardAmount) {
          rewardEarned = offer.maxRewardAmount;
        }
        break;
      case 'FREE_ITEM':
        rewardEarned = offer.rewardValue;
        break;
    }

    // Update reward and offer
    const [updatedReward] = await prisma.$transaction([
      prisma.userReward.update({
        where: { id: reward.id },
        data: {
          status: 'REDEEMED',
          redeemedAt: new Date(),
          purchaseAmount,
          rewardEarned,
        },
      }),
      prisma.partnerOffer.update({
        where: { id: offer.id },
        data: { totalRedeemed: { increment: 1 } },
      }),
    ]);

    return updatedReward;
  },

  async getUserRewards(userId: string) {
    return prisma.userReward.findMany({
      where: { userId },
      include: { offer: { include: { business: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getRewardByCode(redemptionCode: string) {
    return prisma.userReward.findFirst({
      where: { redemptionCode },
      include: { offer: { include: { business: true } } },
    });
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  
  async getPartnerAnalytics(businessId: string) {
    const [offers, enrollments, totalRedeemed, totalRewards] = await Promise.all([
      prisma.partnerOffer.count({ where: { businessId } }),
      prisma.partnerOffer.findMany({ where: { businessId } }),
      prisma.userReward.count({
        where: { offer: { businessId }, status: 'REDEEMED' },
      }),
      prisma.userReward.aggregate({
        where: { offer: { businessId }, status: 'REDEEMED' },
        _sum: { rewardEarned: true, purchaseAmount: true },
      }),
    ]);

    return {
      totalOffers: offers,
      activeOffers: offers,
      totalRedeemed,
      totalRewardsPaid: totalRewards._sum.rewardEarned || 0,
      totalPurchaseVolume: totalRewards._sum.purchaseAmount || 0,
    };
  },

  async getStats() {
    const [totalOffers, totalRedeemed, totalRewards, activePartners] = await Promise.all([
      prisma.partnerOffer.count({ where: { active: true } }),
      prisma.userReward.count({ where: { status: 'REDEEMED' } }),
      prisma.userReward.aggregate({
        where: { status: 'REDEEMED' },
        _sum: { rewardEarned: true },
      }),
      prisma.partnerEnrollment.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      activeOffers: totalOffers,
      totalRedeemed,
      totalRewardsPaid: totalRewards._sum.rewardEarned || 0,
      activePartners,
    };
  },
};
