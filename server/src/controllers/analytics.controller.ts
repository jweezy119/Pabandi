import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';

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

    // Get comprehensive analytics
    const [
      totalReservations,
      upcomingReservations,
      recentNoShows,
      revenue,
    ] = await Promise.all([
      prisma.reservation.count({
        where: { businessId: business.id },
      }),
      prisma.reservation.count({
        where: {
          businessId: business.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservationDate: { gte: new Date() },
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
    ]);

    res.json({
      success: true,
      data: {
        analytics: {
          totalReservations,
          upcomingReservations,
          recentNoShows,
          revenue: revenue._sum.amount || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
