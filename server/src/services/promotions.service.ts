import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const promotionsService = {
  // ── Vendor Promotions ────────────────────────────────────────────────────
  
  async createPromotion(data: {
    businessId: string;
    title: string;
    description: string;
    promotionType: string;
    value: number;
    minPurchase?: number;
    maxDiscount?: number;
    quantityLimit?: number;
    perCustomerLimit?: number;
    customerSegments?: string[];
    categories?: string[];
    startsAt: Date;
    endsAt: Date;
  }) {
    return prisma.vendorPromotion.create({
      data: {
        ...data,
        isActive: true,
        totalRedeemed: 0,
        totalSavings: 0,
      },
    });
  },

  async listPromotions(params?: { businessId?: string; active?: boolean; segment?: string }) {
    const where: any = {};
    if (params?.businessId) where.businessId = params.businessId;
    if (params?.active !== undefined) where.isActive = params.active;
    
    return prisma.vendorPromotion.findMany({
      where,
      include: { business: { select: { id: true, name: true, logoUrl: true, address: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getPromotion(id: string) {
    return prisma.vendorPromotion.findUnique({
      where: { id },
      include: { business: true },
    });
  },

  // ── Redemptions ──────────────────────────────────────────────────────────
  
  async redeemPromotion(userId: string, promotionId: string) {
    const promotion = await prisma.vendorPromotion.findUnique({ where: { id: promotionId } });
    if (!promotion) throw new Error('Promotion not found');
    if (!promotion.isActive) throw new Error('Promotion not active');
    
    // Check per-customer limit
    const existingRedemptions = await prisma.promotionRedemption.count({
      where: { userId, promotionId },
    });
    if (existingRedemptions >= promotion.perCustomerLimit) {
      throw new Error('You have already redeemed this promotion');
    }

    const code = `PROMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    return prisma.promotionRedemption.create({
      data: {
        promotionId,
        userId,
        status: 'ACTIVE',
        redemptionCode: code,
        discountAmount: 0,
      },
    });
  },

  async usePromotion(userId: string, code: string, purchaseAmount: number) {
    const redemption = await prisma.promotionRedemption.findFirst({
      where: { userId, redemptionCode: code, status: 'ACTIVE' },
      include: { promotion: true },
    });
    
    if (!redemption) throw new Error('Invalid or expired promotion code');
    
    const promotion = redemption.promotion;
    let discount = 0;
    
    switch (promotion.promotionType) {
      case 'DISCOUNT_PERCENT':
        discount = purchaseAmount * (promotion.value / 100);
        break;
      case 'DISCOUNT_FIXED':
        discount = promotion.value;
        break;
      case 'FREE_SHIPPING':
        discount = 0; // applied at checkout
        break;
      case 'BOGO':
        discount = purchaseAmount / 2;
        break;
      case 'VOLUME_DISCOUNT':
        if (promotion.minPurchase && purchaseAmount >= promotion.minPurchase) {
          discount = purchaseAmount * (promotion.value / 100);
        }
        break;
    }
    
    if (promotion.maxDiscount && discount > promotion.maxDiscount) {
      discount = promotion.maxDiscount;
    }
    
    // Update redemption and promotion
    const [updated] = await prisma.$transaction([
      prisma.promotionRedemption.update({
        where: { id: redemption.id },
        data: {
          status: 'USED',
          discountAmount: discount,
          purchaseAmount,
          purchaseDate: new Date(),
        },
      }),
      prisma.vendorPromotion.update({
        where: { id: promotion.id },
        data: {
          totalRedeemed: { increment: 1 },
          totalSavings: { increment: discount },
        },
      }),
    ]);
    
    return { redemption: updated, discount };
  },

  async getUserRedemptions(userId: string) {
    return prisma.promotionRedemption.findMany({
      where: { userId },
      include: { promotion: { include: { business: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  // ── Loyalty Programs ─────────────────────────────────────────────────────
  
  async createLoyaltyProgram(data: {
    businessId: string;
    name: string;
    description: string;
    programType: string;
    pointsPerDollar?: number;
    pointValue?: number;
    tierThresholds?: any;
  }) {
    return prisma.loyaltyProgram.create({ data });
  },

  async enrollInProgram(userId: string, programId: string) {
    return prisma.loyaltyMembership.create({
      data: { programId, userId },
    });
  },

  async recordVisit(userId: string, businessId: string, purchaseAmount: number) {
    // Find or create membership
    const program = await prisma.loyaltyProgram.findUnique({ where: { businessId } });
    if (!program) return null;
    
    let membership = await prisma.loyaltyMembership.findFirst({
      where: { programId: program.id, userId },
    });
    
    if (!membership) {
      membership = await prisma.loyaltyMembership.create({
        data: { programId: program.id, userId },
      });
    }
    
    // Update membership
    const pointsEarned = Math.floor(purchaseAmount * program.pointsPerDollar);
    const newLifetimePoints = membership.lifetimePoints + pointsEarned;
    const newTotalSpent = membership.totalSpent + purchaseAmount;
    const newTotalVisits = membership.totalVisits + 1;
    
    // Calculate tier
    let currentTier = 'BRONZE';
    if (program.tierThresholds) {
      const thresholds = program.tierThresholds as any;
      if (newLifetimePoints >= (thresholds.platinum || 5000)) currentTier = 'PLATINUM';
      else if (newLifetimePoints >= (thresholds.gold || 1000)) currentTier = 'GOLD';
      else if (newLifetimePoints >= (thresholds.silver || 500)) currentTier = 'SILVER';
    }
    
    // Update customer-vendor relation
    await prisma.customerVendorRelation.upsert({
      where: { userId_businessId: { userId, businessId } },
      update: {
        totalPurchases: { increment: 1 },
        totalSpent: { increment: purchaseAmount },
        lastPurchaseAt: new Date(),
        averageOrder: newTotalSpent / newTotalVisits,
        segment: newTotalVisits >= 5 ? 'VIP' : 'ACTIVE',
        isVIP: newTotalVisits >= 5,
      },
      create: {
        userId,
        businessId,
        totalPurchases: 1,
        totalSpent: purchaseAmount,
        lastPurchaseAt: new Date(),
        averageOrder: purchaseAmount,
        segment: 'NEW',
      },
    });
    
    return prisma.loyaltyMembership.update({
      where: { id: membership.id },
      data: {
        pointsBalance: { increment: pointsEarned },
        lifetimePoints: newLifetimePoints,
        currentTier,
        totalVisits: newTotalVisits,
        totalSpent: newTotalSpent,
        lastVisitAt: new Date(),
      },
    });
  },

  async getMembership(userId: string, businessId: string) {
    const program = await prisma.loyaltyProgram.findUnique({ where: { businessId } });
    if (!program) return null;
    
    return prisma.loyaltyMembership.findFirst({
      where: { programId: program.id, userId },
      include: { program: true },
    });
  },

  async redeemPoints(userId: string, businessId: string, points: number) {
    const membership = await this.getMembership(userId, businessId);
    if (!membership) throw new Error('Not enrolled in loyalty program');
    if (membership.pointsBalance < points) throw new Error('Insufficient points');
    
    const value = points * (membership.program.pointValue || 0.01);
    
    return prisma.loyaltyMembership.update({
      where: { id: membership.id },
      data: { pointsBalance: { decrement: points } },
    });
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  
  async getVendorAnalytics(businessId: string) {
    const [promotions, loyalty, relations, topCustomers] = await Promise.all([
      prisma.vendorPromotion.count({ where: { businessId } }),
      prisma.loyaltyProgram.findUnique({ where: { businessId } }),
      prisma.customerVendorRelation.findMany({ where: { businessId } }),
      prisma.customerVendorRelation.findMany({
        where: { businessId },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
    
    const totalRevenue = relations.reduce((sum, r) => sum + r.totalSpent, 0);
    const vipCustomers = relations.filter(r => r.segment === 'VIP').length;
    
    return {
      totalPromotions: promotions,
      loyaltyEnrolled: await prisma.loyaltyMembership.count({
        where: { program: { businessId } },
      }),
      totalCustomers: relations.length,
      totalRevenue,
      vipCustomers,
      topCustomers,
    };
  },

  async getAvailableForUser(userId: string) {
    // Get all active promotions where user hasn't exceeded limit
    const allPromotions = await prisma.vendorPromotion.findMany({
      where: { isActive: true },
      include: { business: { select: { id: true, name: true, address: true } } },
    });
    
    // Filter by user's redemptions
    const userRedemptions = await prisma.promotionRedemption.findMany({
      where: { userId },
    });
    
    const available = allPromotions.filter(p => {
      const userCount = userRedemptions.filter(r => r.promotionId === p.id).length;
      return userCount < p.perCustomerLimit;
    });
    
    return available;
  },
};
