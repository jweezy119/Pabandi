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
