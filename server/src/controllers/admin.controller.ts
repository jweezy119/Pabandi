import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { listAdminPlugins, getAdminPlugin, updateAdminPlugin } from '../services/openwa_admin.service';
import { fail, ok } from '../utils/apiResponse';

// ─── GET /admin/stats ───────────────────────────────────────────────

export const getAdminStats = async (_req: AuthRequest, res: Response, next: NextFunction) => {
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

    return ok(res, {
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

    return ok(res, { users, total, page: parseInt(page as string), limit: parseInt(limit as string) });
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
    if (!user) return fail(res, 'User not found', 404);
    return ok(res, { user });
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

    return ok(res, { reservations, total });
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

    return ok(res, { businesses });
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

    return ok(res, { business });
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
    return ok(res, { user });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/openwa/plugins ─────────────────────────────────────

export const getOpenwaPlugins = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugins = listAdminPlugins();
    return ok(res, { plugins, source: 'openwa_catalog' });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/openwa/plugins/:id ─────────────────────────────────

export const getOpenwaPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugin = getAdminPlugin(req.params.id);
    if (!plugin) return fail(res, 'Plugin not found', 404);
    return ok(res, { plugin });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/openwa/plugins/:id ───────────────────────────────

export const updateOpenwaPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugin = updateAdminPlugin(req.params.id, req.body || {});
    return ok(res, { plugin });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/profile-requests ─────────────────────────────────────

export const getProfileRequests = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, role: true } }
      }
    });
    return ok(res, { requests });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /admin/profile-requests/:id/approve ─────────────────────────

export const approveProfileRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request = await prisma.profileChangeRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== 'PENDING') {
      return fail(res, 'Pending request not found', 404);
    }

    const changes = request.requestedChanges as Record<string, any>;
    const updateData: any = {};
    if (changes.firstName) updateData.firstName = changes.firstName;
    if (changes.lastName) updateData.lastName = changes.lastName;
    if (changes.profilePictureUrl) updateData.profilePictureUrl = changes.profilePictureUrl;

    await prisma.$transaction([
      prisma.user.update({ where: { id: request.userId }, data: updateData }),
      prisma.profileChangeRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } }),
    ]);

    return ok(res, { message: 'Profile change approved' });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /admin/profile-requests/:id/reject ──────────────────────────

export const rejectProfileRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request = await prisma.profileChangeRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
    });
    return ok(res, { request });
  } catch (error) {
    next(error);
  }
};
