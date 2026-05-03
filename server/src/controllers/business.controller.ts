import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { BusinessCategory, UserRole } from '@prisma/client';

export const createBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      description,
      category,
      address,
      city,
      phone,
      email,
      website,
      timezone,
    } = req.body;

    // Check if user already has a business
    const existingBusiness = await prisma.business.findUnique({
      where: { ownerId: req.user!.id },
    });

    if (existingBusiness) {
      throw new CustomError('User already has a business registered', 409);
    }

    // Normalize category to enum (fallback to OTHER)
    const resolvedCategory: BusinessCategory = (category && (Object.values(BusinessCategory) as string[]).includes(category))
      ? (category as BusinessCategory)
      : BusinessCategory.OTHER;

    // Create business
    const business = await prisma.business.create({
      data: {
        ownerId: req.user!.id,
        name,
        description,
        category: resolvedCategory,
        address,
        city: city || 'Karachi',
        phone,
        email,
        website,
        timezone: timezone || 'Asia/Karachi',
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create default business settings
    await prisma.businessSettings.create({
      data: {
        businessId: business.id,
      },
    });

    // Promote user to BUSINESS_OWNER if not already
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        role: UserRole.BUSINESS_OWNER,
      },
      select: { id: true, role: true },
    });

    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: { business, user },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        businessHours: true,
        tables: {
          where: { isActive: true },
        },
        settings: true,
      },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    // Check if user has access
    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      // Public view (limited data)
      const publicBusiness = {
        id: business.id,
        name: business.name,
        description: business.description,
        category: business.category,
        address: business.address,
        city: business.city,
        phone: business.phone,
        email: business.email,
        website: business.website,
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        businessHours: business.businessHours,
      };

      return res.json({
        success: true,
        data: { business: publicBusiness },
      });
    }

    res.json({
      success: true,
      data: { business },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBusiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const updated = await prisma.business.update({
      where: { id },
      data: req.body,
    });

    res.json({
      success: true,
      message: 'Business updated successfully',
      data: { business: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessReservations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, date, page = 1, limit = 20 } = req.query;

    // Verify business ownership
    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const where: any = { businessId: id };
    if (status) {
      where.status = status;
    }
    if (date) {
      const dateStart = new Date(date as string);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date as string);
      dateEnd.setHours(23, 59, 59, 999);
      where.reservationDate = {
        gte: dateStart,
        lte: dateEnd,
      };
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          table: true,
        },
        orderBy: { reservationDate: 'asc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        reservations,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBusinessAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Verify business ownership
    const business = await prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new CustomError('Business not found', 404);
    }

    if (
      req.user!.role !== 'ADMIN' &&
      business.ownerId !== req.user!.id
    ) {
      throw new CustomError('Unauthorized', 403);
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const now = new Date();

    const [
      totalReservations,
      confirmed,
      noShows,
      cancellations,
      completed,
      reservationsByStatus,
      protectedRevenue,
      unprotectedRevenue,
      upcomingReservations,
      allConcluded,
    ] = await Promise.all([
      prisma.reservation.count({
        where: {
          businessId: id,
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'CONFIRMED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'NO_SHOW',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'CANCELLED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.count({
        where: {
          businessId: id,
          status: 'COMPLETED',
          reservationDate: dateFilter,
        },
      }),
      prisma.reservation.groupBy({
        by: ['status'],
        where: {
          businessId: id,
          reservationDate: dateFilter,
        },
        _count: true,
      }),
      // Protected revenue (deposit captured)
      prisma.reservation.aggregate({
        where: {
          businessId: id,
          depositRequired: true,
          depositStatus: { in: ['PAID', 'APPLIED_TO_SERVICE', 'REIMBURSED_TO_BUSINESS'] },
          reservationDate: dateFilter,
        },
        _sum: { depositAmount: true },
      }),
      // Unprotected (no deposit) bookings count
      prisma.reservation.count({
        where: {
          businessId: id,
          depositRequired: false,
          reservationDate: dateFilter,
        },
      }),
      // Upcoming with risk data
      prisma.reservation.findMany({
        where: {
          businessId: id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservationDate: { gte: now },
        },
        select: {
          riskScore: true,
          depositAmount: true,
          depositRequired: true,
          numberOfGuests: true,
          reservationDate: true,
          reservationTime: true,
        },
        orderBy: { reservationDate: 'asc' },
        take: 50,
      }),
      // All concluded reservations for day-of-week breakdown
      prisma.reservation.findMany({
        where: {
          businessId: id,
          status: { in: ['COMPLETED', 'NO_SHOW'] },
          reservationDate: dateFilter,
        },
        select: {
          reservationDate: true,
          reservationTime: true,
          status: true,
          riskScore: true,
          numberOfGuests: true,
        },
      }),
    ]);

    const noShowRate =
      totalReservations > 0 ? (noShows / totalReservations) * 100 : 0;
    const cancellationRate =
      totalReservations > 0 ? (cancellations / totalReservations) * 100 : 0;
    const completionRate =
      totalReservations > 0 ? (completed / totalReservations) * 100 : 0;

    // ── No-show by day of week ──
    const dayBreakdown: Record<number, { total: number; noShows: number }> = {};
    for (let d = 0; d <= 6; d++) dayBreakdown[d] = { total: 0, noShows: 0 };
    for (const r of allConcluded) {
      const day = new Date(r.reservationDate).getDay();
      dayBreakdown[day].total++;
      if (r.status === 'NO_SHOW') dayBreakdown[day].noShows++;
    }
    const noShowByDay = Object.entries(dayBreakdown).map(([day, s]) => ({
      day: Number(day),
      total: s.total,
      noShows: s.noShows,
      rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
    }));

    // ── No-show by hour (heatmap) ──
    const hourBreakdown: Record<number, { total: number; noShows: number }> = {};
    for (let h = 0; h <= 23; h++) hourBreakdown[h] = { total: 0, noShows: 0 };
    for (const r of allConcluded) {
      const hour = parseInt(r.reservationTime?.split(':')[0] || '12', 10);
      hourBreakdown[hour].total++;
      if (r.status === 'NO_SHOW') hourBreakdown[hour].noShows++;
    }
    const noShowByHour = Object.entries(hourBreakdown).map(([h, s]) => ({
      hour: Number(h),
      total: s.total,
      noShows: s.noShows,
      rate: s.total > 0 ? Math.round((s.noShows / s.total) * 100) : 0,
    }));

    // ── Average risk of upcoming ──
    const avgUpcomingRisk = upcomingReservations.length > 0
      ? Math.round(upcomingReservations.reduce((s, r) => s + (r.riskScore || 0), 0) / upcomingReservations.length)
      : 0;

    res.json({
      success: true,
      data: {
        analytics: {
          totalReservations,
          confirmed,
          noShows,
          cancellations,
          completed,
          noShowRate: parseFloat(noShowRate.toFixed(2)),
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          completionRate: parseFloat(completionRate.toFixed(2)),
          reservationsByStatus,
          protectedRevenue: protectedRevenue._sum.depositAmount || 0,
          unprotectedBookings: unprotectedRevenue,
          avgUpcomingRisk,
          noShowByDay,
          noShowByHour,
          businessCategory: business.category,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
