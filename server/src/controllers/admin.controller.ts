import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── GET /admin/stats ───────────────────────────────────────────────
export const getAdminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalBusinesses,
      totalReservations,
      completedReservations,
      usersWithReservations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: 'COMPLETED' } }),
      prisma.reservation.groupBy({ by: ['customerId'] }).then(r => r.length),
    ]);

    res.json({
      success: true,
      data: {
        funnel: {
          signedUp: totalUsers,
          madeReservation: usersWithReservations,
          completedBooking: completedReservations,
        },
        totals: {
          users: totalUsers,
          businesses: totalBusinesses,
          reservations: totalReservations,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/users ───────────────────────────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (role) where.role = String(role).toUpperCase();

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          _count: { select: { reservations: true } },
          business: { select: { id: true, name: true, isVerified: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: { users, total, page: parseInt(page as string), limit: parseInt(limit as string) } });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/users/:id ──────────────────────────────────────────
export const getUserDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { business: { select: { name: true } } },
        },
        business: true,
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/reservations ────────────────────────────────────────
export const getAllReservations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = String(status).toUpperCase();

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { name: true, category: true } },
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({ success: true, data: { reservations, total } });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/businesses ──────────────────────────────────────────
export const getAllBusinesses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { verified } = req.query;
    const where: any = {};
    if (verified !== undefined) where.isVerified = verified === 'true';

    const businesses = await prisma.business.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { reservations: true } },
      },
    });

    res.json({ success: true, data: { businesses } });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/businesses/:id/verify ────────────────────────────
export const verifyBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { isVerified: true },
    });
    res.json({ success: true, data: { business } });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/users/:id/role ───────────────────────────────────
export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, role: true },
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
