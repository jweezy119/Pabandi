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

    // Get bookings with details for enhanced stats
    const bookings = await prisma.bottleReservation.findMany({
      where: { promoterId },
      include: {
        venue: { select: { id: true, name: true, city: true } },
        tableType: { select: { id: true, name: true } },
        bottlePackage: { select: { id: true, name: true } },
        guestList: { select: { id: true, date: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate enhanced metrics
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthBookings = bookings.filter(b => b.createdAt >= thisMonth);
    const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const thisMonthCommissionEarned = thisMonthBookings.reduce((sum, b) => {
      const commission = b.totalPrice ? b.totalPrice * 0.5 : 0; // Assuming 50% commission on booking value
      return sum + commission;
    }, 0);

    // Get guest list performance
    const guestLists = await prisma.guestList.findMany({
      where: { promoterId },
      include: { venue: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const confirmedGuestLists = guestLists.filter(gl => gl.status === 'CONFIRMED');
    const arrivedGuestLists = guestLists.filter(gl => gl.status === 'ARRIVED');

    // Calculate average booking value
    const avgBookingValue = bookings.length > 0
      ? bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0) / bookings.length
      : 0;

    // Calculate revenue per guest list
    const revenuePerGuestList = guestLists.length > 0
      ? bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0) / guestLists.length
      : 0;

    return {
      promoterId,
      totalBookings,
      totalCommission,
      conversionRate,
      totalGuestLists,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      // Enhanced stats
      thisMonthBookings: thisMonthBookings.length,
      thisMonthRevenue,
      thisMonthCommissionEarned,
      avgBookingValue,
      revenuePerGuestList,
      guestListStats: {
        total: guestLists.length,
        confirmed: confirmedGuestLists.length,
        arrived: arrivedGuestLists.length,
        confirmationRate: guestLists.length > 0
          ? Math.round((confirmedGuestLists.length / guestLists.length) * 100) / 100
          : 0,
        arrivalRate: confirmedGuestLists.length > 0
          ? Math.round((arrivedGuestLists.length / confirmedGuestLists.length) * 100) / 100
          : 0,
      },
      recentBookings: bookings.slice(0, 10).map(b => ({
        id: b.id,
        date: b.createdAt,
        venueName: b.venue?.name,
        tableName: b.tableType?.name,
        packageName: b.bottlePackage?.name,
        totalPrice: b.totalPrice || 0,
        status: b.status,
      })),
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
   * Get all bookings attributed to a promoter with optional filtering
   */
  async getPromoterBookings(promoterId: string, options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    venueId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { promoterId };
    
    if (options?.status) where.status = options.status;
    if (options?.startDate && options?.endDate) {
      where.createdAt = {
        gte: options.startDate,
        lte: options.endDate,
      };
    } else if (options?.startDate) {
      where.createdAt = { gte: options.startDate };
    } else if (options?.endDate) {
      where.createdAt = { lte: options.endDate };
    }
    
    if (options?.venueId) {
      where.venueId = options.venueId;
    }

    const skip = options?.offset || 0;
    const take = options?.limit || 50;

    const [bookings, total] = await Promise.all([
      prisma.bottleReservation.findMany({
        where,
        include: {
          venue: { select: { id: true, name: true, city: true, address: true } },
          tableType: { select: { id: true, name: true, basePrice: true } },
          bottlePackage: { select: { id: true, name: true, bottleType: true, basePrice: true } },
          guestList: { select: { id: true, date: true, status: true, partySize: true } },
          promoter: { select: { id: true, name: true, instagram: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.bottleReservation.count({ where }),
    ]);

    // Calculate summary statistics
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + ((b.totalPrice || 0) * 0.5), 0); // 50% commission
    const averageBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;

    // Group by venue
    const venueStats = bookings.reduce((acc, b) => {
      if (!b.venue?.id) return acc;
      if (!acc[b.venue.id]) {
        acc[b.venue.id] = {
          venueId: b.venue.id,
          venueName: b.venue.name,
          city: b.venue.city,
          address: b.venue.address,
          bookings: 0,
          revenue: 0,
          commission: 0,
          averageValue: 0,
        };
      }
      acc[b.venue.id].bookings++;
      acc[b.venue.id].revenue += b.totalPrice || 0;
      acc[b.venue.id].commission += (b.totalPrice || 0) * 0.5;
      return acc;
    }, {} as Record<string, any>);

    // Convert to array
    const venueStatsArray = Object.values(venueStats);

    // Calculate dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter bookings by date for month calculations
    const thisMonthBookings = bookings.filter(b => b.createdAt >= startOfMonth);
    const lastMonthBookings = bookings.filter(b => b.createdAt >= startOfLastMonth && b.createdAt <= endOfLastMonth);

    // Calculate month-over-month growth
    const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const monthOverMonthGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    return {
      bookings,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        pages: Math.ceil(total / take),
      },
      summary: {
        totalRevenue,
        totalCommission,
        averageBookingValue,
        bookingsCount: bookings.length,
        thisMonthRevenue,
        lastMonthRevenue,
        monthOverMonthGrowth: Math.round(monthOverMonthGrowth * 100) / 100,
      },
      venueStats: venueStatsArray,
    };
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
