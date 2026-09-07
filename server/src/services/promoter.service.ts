import { logger } from '../utils/logger';
import { prisma } from '../utils/database';


export interface RegisterPromoterData {
  name: string;
  phone?: string;
  instagram?: string;
  bio?: string;
}

export const promoterService = {
  /**
   * Register a new promoter profile
   */
  async registerPromoter(userId: string, data: RegisterPromoterData) {
    // Check if user already has a promoter profile
    const existing = await prisma.promoter.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new Error('User already has a promoter profile');
    }

    return prisma.promoter.create({
      data: {
        userId,
        name: data.name,
        phone: data.phone,
        instagram: data.instagram,
        bio: data.bio,
      },
    });
  },

  /**
   * Get promoter by user ID
   */
  async getPromoterByUserId(userId: string) {
    return prisma.promoter.findUnique({
      where: { userId },
      include: {
        promoCodes: true,
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  },

  /**
   * Get promoter stats (total bookings, commission, conversion rate)
   */
  async getPromoterStats(promoterId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
    });

    if (!promoter) {
      throw new Error('Promoter not found');
    }

    // Total bookings attributed to this promoter
    const totalBookings = await prisma.bottleReservation.count({
      where: { promoterId },
    });

    // Total commission earned
    const commissionResult = await prisma.referralLedger.aggregate({
      where: {
        profileId: promoter.userId,
        type: 'BOOKING_COMMISSION',
      },
      _sum: { amount: true },
    });

    const totalCommission = commissionResult._sum.amount || 0;

    // Conversion rate: bookings / guest lists
    const totalGuestLists = await prisma.guestList.count({
      where: { promoterId },
    });

    const conversionRate = totalGuestLists > 0
      ? Math.round((totalBookings / totalGuestLists) * 100) / 100
      : 0;

    // Average rating
    const reviews = await prisma.promoterReview.findMany({
      where: { promoterId },
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    return {
      promoterId,
      totalBookings,
      totalCommission,
      conversionRate,
      totalGuestLists,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    };
  },

  /**
   * Generate a unique referral code for a promoter
   */
  async generateReferralCode(promoterId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
    });

    if (!promoter) {
      throw new Error('Promoter not found');
    }

    // Generate unique code
    let code: string;
    let isUnique = false;

    do {
      code = `PROMO-${require('crypto').randomBytes(2).toString('hex').toUpperCase()}`;
      const existing = await prisma.promoCode.findUnique({
        where: { code },
      });
      if (!existing) isUnique = true;
    } while (!isUnique);

    // Create promo code
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1); // Valid for 1 year

    const promoCode = await prisma.promoCode.create({
      data: {
        code,
        promoterId,
        type: 'PERCENTAGE',
        value: 10, // 10% discount
        maxUses: 100,
        validUntil,
      },
    });

    return promoCode;
  },

  /**
   * Get all bookings attributed to a promoter
   */
  async getPromoterBookings(promoterId: string) {
    return prisma.bottleReservation.findMany({
      where: { promoterId },
      include: {
        venue: {
          select: { id: true, name: true, city: true },
        },
        tableType: { select: { id: true, name: true } },
        bottlePackage: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get top promoters by commission (leaderboard)
   */
  async getPromoterLeaderboard(limit: number = 10) {
    const results = await prisma.referralLedger.groupBy({
      by: ['profileId'],
      where: { type: 'BOOKING_COMMISSION' },
      _sum: { amount: true },
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: limit,
    });

    // Fetch promoter details for each entry
    const leaderboard = await Promise.all(
      results.map(async (entry) => {
        const promoter = await prisma.promoter.findUnique({
          where: { userId: entry.profileId },
          select: {
            id: true,
            name: true,
            instagram: true,
            verified: true,
          },
        });

        return {
          promoter,
          totalCommission: entry._sum.amount || 0,
        };
      })
    );

    return leaderboard.filter((entry) => entry.promoter !== null);
  },

  /**
   * Credit commission to promoter wallet
   */
  async creditPromoter(promoterId: string, amount: number, bookingId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
    });

    if (!promoter) {
      logger.warn(`Promoter ${promoterId} not found for commission credit`);
      return null;
    }

    return prisma.referralLedger.create({
      data: {
        profileId: promoter.userId,
        type: 'BOOKING_COMMISSION',
        amount,
        currency: 'USD',
        reservationId: bookingId,
        commissionRate: 0.1,
      },
    });
  },

  /**
   * Get promoter wallet balance and history
   */
  async getPromoterWallet(promoterId: string) {
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
    });

    if (!promoter) {
      throw new Error('Promoter not found');
    }

    // Get all ledger entries for this promoter
    const entries = await prisma.referralLedger.findMany({
      where: {
        profileId: promoter.userId,
        type: 'BOOKING_COMMISSION',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total balance
    const totalBalance = entries.reduce((sum, entry) => {
      return entry.isReversed ? sum - entry.amount : sum + entry.amount;
    }, 0);

    return {
      promoterId,
      userId: promoter.userId,
      balance: Math.round(totalBalance * 100) / 100,
      totalEarnings: entries.reduce((sum, e) => e.isReversed ? sum : sum + e.amount, 0),
      history: entries.slice(0, 50),
    };
  },
};
