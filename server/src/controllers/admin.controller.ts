import { Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { listAdminPlugins, getAdminPlugin, updateAdminPlugin } from '../services/openwa_admin.service';
import { fail, ok } from '../utils/apiResponse';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

// ─── POST /admin/setup ────────────────────────────────────────────
// PUBLIC bootstrap: create first ADMIN user if and only if zero users exist

export const setupAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if any user exists
    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      return fail(res, 'Admin already exists', 409);
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return fail(res, 'Valid email is required', 400);
    }

    // Validate password
    if (!password || password.length < 6) {
      return fail(res, 'Password must be at least 6 characters', 400);
    }

    // Hash password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the first admin user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: firstName || '',
        lastName: lastName || '',
        role: UserRole.ADMIN,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (error: any) {
    // Handle unique constraint race condition
    if (error?.code === 'P2002') {
      return fail(res, 'Admin already exists', 409);
    }
    next(error);
  }
};

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

// ─── GET /admin/properties ────────────────────────────────────────

export const getAllProperties = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const properties = await prisma.propertyManagerProperty.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { companyName: true, slug: true } },
        _count: { select: { tenants: true } },
      },
    });
    return ok(res, { properties });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/tenants ──────────────────────────────────────────

export const getAllTenants = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.propertyTenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        manager: { select: { companyName: true } },
        property: { select: { title: true, address: true, city: true } },
      },
    });
    return ok(res, { tenants });
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/leases ───────────────────────────────────────────

export const getAllLeases = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const leases = await prisma.propertyLease.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { title: true, address: true, city: true } },
        unit: { select: { unitNumber: true } },
      },
    });
    return ok(res, { leases });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/users/:id ──────────────────────────────────────

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return fail(res, 'User not found', 404);
    if (target.role === 'ADMIN') return fail(res, 'Cannot delete admin users', 403);

    await prisma.user.delete({ where: { id: req.params.id } });
    return ok(res, { message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/businesses/:id ─────────────────────────────────

export const softDeleteBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    return ok(res, { business });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return fail(res, 'Business not found', 404);
    }
    next(error);
  }
};

// ─── PATCH /admin/businesses/:id ──────────────────────────────────

export const updateBusiness = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'category', 'description', 'latitude', 'longitude', 'isVerified', 'isActive'] as const;
    const data: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const business = await prisma.business.update({
      where: { id: req.params.id },
      data,
    });
    return ok(res, { business });
  } catch (error) {
    if ((error as any)?.code === 'P2025') {
      return fail(res, 'Business not found', 404);
    }
    next(error);
  }
};

// ─── GET /admin/bookings ─────────────────────────────────────────

export const getAllBookings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = String(status).toUpperCase();

    const [bookings, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { id: true, name: true, category: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          payments: true,
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return ok(res, { bookings, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    next(error);
  }
};
