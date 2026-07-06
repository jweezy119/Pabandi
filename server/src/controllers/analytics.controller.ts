                             import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { noShowPredictor } from '../services/ai/noShowPredictor';

export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get user's business
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      return res.json({
        success: true,
        data: {
          analytics: null,
          message: 'No business found for user',
        },
      });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get comprehensive analytics
    const [
      totalReservations,
      upcomingReservations,
      recentNoShows,
      revenue,
      completedCount,
      noShowCount,
      cancelledCount,
      last30DaysReservations,
      last7DaysReservations,
      upcomingRisky,
      protectedRevenue,
      noShowByDay,
      noShowByHour,
    ] = await Promise.all([
      prisma.reservation.count({
        where: { businessId: business.id },
      }),
      prisma.reservation.count({
        where: {
          businessId: business.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservationDate: { gte: now },
        },
      }),
      prisma.reservation.findMany({
        where: {
          businessId: business.id,
          status: 'NO_SHOW',
        },
        orderBy: { reservationDate: 'desc' },
        take: 10,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.payment.aggregate({
        where: {
          reservation: {
            businessId: business.id,
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.reservation.count({
        where: { businessId: business.id, status: 'COMPLETED' },
      }),
      prisma.reservation.count({
        where: { businessId: business.id, status: 'NO_SHOW' },
      }),
      prisma.reservation.count({
        where: { businessId: business.id, status: 'CANCELLED' },
      }),
      prisma.reservation.count({
        where: {
          businessId: business.id,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: business.id,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      // Upcoming reservations with high risk scores
      prisma.reservation.findMany({
        where: {
          businessId: business.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservationDate: { gte: now },
          riskScore: { gte: 40 },
        },
        orderBy: { riskScore: 'desc' },
        take: 10,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              reliabilityScore: true,
            },
          },
        },
      }),
      // Protected revenue (deposit amounts on upcoming reservations)
      prisma.reservation.aggregate({
        where: {
          businessId: business.id,
          depositRequired: true,
          depositStatus: { in: ['PAID', 'APPLIED_TO_SERVICE'] },
        },
        _sum: {
          depositAmount: true,
        },
      }),
      // No-show heatmap data
      noShowPredictor.getNoShowByDayOfWeek(business.id),
      noShowPredictor.getNoShowByHour(business.id),
    ]);

    // Calculate rates
    const concludedTotal = completedCount + noShowCount + cancelledCount;
    const noShowRate = concludedTotal > 0 ? Math.round((noShowCount / concludedTotal) * 100) : 0;
    const completionRate = concludedTotal > 0 ? Math.round((completedCount / concludedTotal) * 100) : 0;

    // Revenue at risk (sum of estimated value on upcoming high-risk bookings)
    const revenueAtRisk = upcomingRisky.reduce((sum, r) => sum + (r.depositAmount || 1000), 0);

    // Top risk factors across all upcoming bookings
    const riskFactorCounts: Record<string, number> = {};
    for (const r of upcomingRisky) {
      const factors = r.aiFactors as Record<string, number> | null;
      if (factors) {
        for (const key of Object.keys(factors)) {
          riskFactorCounts[key] = (riskFactorCounts[key] || 0) + 1;
        }
      }
    }
    const topRiskFactors = Object.entries(riskFactorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count }));

    // Overbooking recommendation (for event venues)
    const avgUpcomingRisk = upcomingRisky.length > 0
      ? Math.round(upcomingRisky.reduce((s, r) => s + (r.riskScore || 0), 0) / upcomingRisky.length)
      : 0;

    res.json({
      success: true,
      data: {
        analytics: {
          // Core metrics
          totalReservations,
          upcomingReservations,
          completedCount,
          noShowCount,
          cancelledCount,

          // Rates
          noShowRate,
          completionRate,

          // Revenue
          revenue: revenue._sum.amount || 0,
          protectedRevenue: protectedRevenue._sum.depositAmount || 0,
          revenueAtRisk,

          // Trend data
          last7Days: last7DaysReservations,
          last30Days: last30DaysReservations,

          // AI Intelligence
          upcomingRiskyBookings: upcomingRisky,
          topRiskFactors,
          averageUpcomingRisk: avgUpcomingRisk,
          recentNoShows,

          // Heatmap data
          noShowByDay,
          noShowByHour,

          // Business info
          businessCategory: business.category,

          // Overbooking advisor (relevant for event venues)
          overbookingAdvice: business.category === 'EVENT_VENUE' ? {
            predictedNoShowPercent: noShowRate,
            safeOverbookMargin: Math.round(noShowRate * 0.7),
          } : undefined,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /analytics/detailed
 * Extended analytics for the dedicated analytics dashboard page.
 * Includes time-series data, deposit breakdowns, and top customers.
 */
export const getDetailedAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const business = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (!business) {
      return res.json({ success: true, data: { analytics: null } });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all reservations in the last 30 days for time-series
    const recentReservations = await prisma.reservation.findMany({
      where: {
        businessId: business.id,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        status: true,
        numberOfGuests: true,
        depositAmount: true,
        depositStatus: true,
        depositRequired: true,
        depositPaid: true,
        cryptoDepositTxHash: true,
        reservationDate: true,
        reservationTime: true,
        createdAt: true,
        riskScore: true,
        customerName: true,
        customerId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily time-series
    const dailyMap: Record<string, { date: string; bookings: number; completed: number; noShows: number; cancelled: number; guests: number; depositTotal: number }> = {};
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { date: key, bookings: 0, completed: 0, noShows: 0, cancelled: 0, guests: 0, depositTotal: 0 };
    }
    for (const r of recentReservations) {
      const key = r.createdAt.toISOString().split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].bookings++;
        dailyMap[key].guests += r.numberOfGuests;
        if (r.status === 'COMPLETED') dailyMap[key].completed++;
        if (r.status === 'NO_SHOW') dailyMap[key].noShows++;
        if (r.status === 'CANCELLED') dailyMap[key].cancelled++;
        if (r.depositAmount) dailyMap[key].depositTotal += r.depositAmount;
      }
    }
    const dailySeries = Object.values(dailyMap);

    // Deposit breakdown
    const depositStats = {
      totalDepositsCollected: recentReservations.filter(r => r.depositPaid || r.depositStatus === 'PAID').length,
      totalDepositAmount: recentReservations.reduce((s, r) => s + (r.depositPaid || r.depositStatus === 'PAID' ? (r.depositAmount || 0) : 0), 0),
      cryptoDeposits: recentReservations.filter(r => r.cryptoDepositTxHash && !r.cryptoDepositTxHash.startsWith('pending_')).length,
      fiatDeposits: recentReservations.filter(r => r.depositPaid && !r.cryptoDepositTxHash).length,
      pendingDeposits: recentReservations.filter(r => r.depositRequired && r.depositStatus === 'PENDING').length,
      refundedDeposits: recentReservations.filter(r => r.cryptoDepositTxHash?.includes('REFUND') || (r.status === 'CANCELLED' && r.depositStatus === 'PAID')).length,
      revenueSavedByDeposits: recentReservations.filter(r => r.status === 'COMPLETED' && r.depositPaid).reduce((s, r) => s + (r.depositAmount || 0), 0),
      noShowsWithDeposit: recentReservations.filter(r => r.status === 'NO_SHOW' && r.depositPaid).length,
      noShowsWithoutDeposit: recentReservations.filter(r => r.status === 'NO_SHOW' && !r.depositPaid).length,
    };

    // Hourly volume heatmap
    const hourlyVolume: number[] = new Array(24).fill(0);
    for (const r of recentReservations) {
      const hour = parseInt(r.reservationTime?.split(':')[0] || '0');
      hourlyVolume[hour]++;
    }

    // Top customers
    const customerMap: Record<string, { name: string; bookings: number; noShows: number; completed: number; totalGuests: number }> = {};
    for (const r of recentReservations) {
      if (!customerMap[r.customerId]) {
        customerMap[r.customerId] = { name: r.customerName, bookings: 0, noShows: 0, completed: 0, totalGuests: 0 };
      }
      customerMap[r.customerId].bookings++;
      customerMap[r.customerId].totalGuests += r.numberOfGuests;
      if (r.status === 'NO_SHOW') customerMap[r.customerId].noShows++;
      if (r.status === 'COMPLETED') customerMap[r.customerId].completed++;
    }
    const topCustomers = Object.entries(customerMap)
      .map(([id, data]) => ({ id, ...data, reliability: data.bookings > 0 ? Math.round((data.completed / data.bookings) * 100) : 0 }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10);

    // Risk score distribution
    const riskDistribution = { low: 0, moderate: 0, high: 0, critical: 0 };
    for (const r of recentReservations) {
      const score = r.riskScore || 0;
      if (score >= 75) riskDistribution.critical++;
      else if (score >= 50) riskDistribution.high++;
      else if (score >= 30) riskDistribution.moderate++;
      else riskDistribution.low++;
    }

    res.json({
      success: true,
      data: {
        analytics: {
          dailySeries,
          depositStats,
          hourlyVolume,
          topCustomers,
          riskDistribution,
          totalReservations30d: recentReservations.length,
          totalGuests30d: recentReservations.reduce((s, r) => s + r.numberOfGuests, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
