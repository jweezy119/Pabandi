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

    const [
      totalReservations,
      confirmed,
      noShows,
      cancellations,
      completed,
      reservationsByStatus,
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
    ]);

    const noShowRate =
      totalReservations > 0 ? (noShows / totalReservations) * 100 : 0;
    const cancellationRate =
      totalReservations > 0 ? (cancellations / totalReservations) * 100 : 0;
    const completionRate =
      totalReservations > 0 ? (completed / totalReservations) * 100 : 0;

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
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
