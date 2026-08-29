"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectProfileRequest = exports.approveProfileRequest = exports.getProfileRequests = exports.updateOpenwaPlugin = exports.getOpenwaPlugin = exports.getOpenwaPlugins = exports.updateUserRole = exports.verifyBusiness = exports.getAllBusinesses = exports.getAllReservations = exports.getUserDetail = exports.getAllUsers = exports.getAdminStats = void 0;
const database_1 = require("../utils/database");
const openwa_admin_service_1 = require("../services/openwa_admin.service");
const apiResponse_1 = require("../utils/apiResponse");
// ─── GET /admin/stats ───────────────────────────────────────────────
const getAdminStats = async (_req, res, next) => {
    try {
        const [totalUsers, totalBusinesses, totalReservations, completedReservations, usersWithReservations,] = await Promise.all([
            database_1.prisma.user.count(),
            database_1.prisma.business.count(),
            database_1.prisma.reservation.count(),
            database_1.prisma.reservation.count({ where: { status: 'COMPLETED' } }),
            database_1.prisma.reservation.groupBy({ by: ['customerId'] }).then(r => r.length),
        ]);
        return (0, apiResponse_1.ok)(res, {
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
    }
    catch (error) {
        next(error);
    }
};
exports.getAdminStats = getAdminStats;
// ─── GET /admin/users ───────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
    try {
        const { role, page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (role)
            where.role = String(role).toUpperCase();
        const [users, total] = await Promise.all([
            database_1.prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
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
            database_1.prisma.user.count({ where }),
        ]);
        return (0, apiResponse_1.ok)(res, { users, total, page: parseInt(page), limit: parseInt(limit) });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllUsers = getAllUsers;
// ─── GET /admin/users/:id ──────────────────────────────────────────
const getUserDetail = async (req, res, next) => {
    try {
        const user = await database_1.prisma.user.findUnique({
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
        if (!user)
            return (0, apiResponse_1.fail)(res, 'User not found', 404);
        return (0, apiResponse_1.ok)(res, { user });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserDetail = getUserDetail;
// ─── GET /admin/reservations ────────────────────────────────────────
const getAllReservations = async (req, res, next) => {
    try {
        const { status, page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (status)
            where.status = String(status).toUpperCase();
        const [reservations, total] = await Promise.all([
            database_1.prisma.reservation.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    business: { select: { name: true, category: true } },
                    customer: { select: { firstName: true, lastName: true, email: true } },
                },
            }),
            database_1.prisma.reservation.count({ where }),
        ]);
        return (0, apiResponse_1.ok)(res, { reservations, total });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllReservations = getAllReservations;
// ─── GET /admin/businesses ──────────────────────────────────────────
const getAllBusinesses = async (req, res, next) => {
    try {
        const { verified } = req.query;
        const where = {};
        if (verified !== undefined)
            where.isVerified = verified === 'true';
        const businesses = await database_1.prisma.business.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                owner: { select: { firstName: true, lastName: true, email: true } },
                _count: { select: { reservations: true } },
            },
        });
        return (0, apiResponse_1.ok)(res, { businesses });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllBusinesses = getAllBusinesses;
// ─── PATCH /admin/businesses/:id/verify ────────────────────────────
const verifyBusiness = async (req, res, next) => {
    try {
        const business = await database_1.prisma.business.update({
            where: { id: req.params.id },
            data: { isVerified: true },
        });
        return (0, apiResponse_1.ok)(res, { business });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyBusiness = verifyBusiness;
// ─── PATCH /admin/users/:id/role ───────────────────────────────────
const updateUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        const user = await database_1.prisma.user.update({
            where: { id: req.params.id },
            data: { role },
            select: { id: true, email: true, role: true },
        });
        return (0, apiResponse_1.ok)(res, { user });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserRole = updateUserRole;
// ─── GET /admin/openwa/plugins ─────────────────────────────────────
const getOpenwaPlugins = async (_req, res, next) => {
    try {
        const plugins = (0, openwa_admin_service_1.listAdminPlugins)();
        return (0, apiResponse_1.ok)(res, { plugins, source: 'openwa_catalog' });
    }
    catch (error) {
        next(error);
    }
};
exports.getOpenwaPlugins = getOpenwaPlugins;
// ─── GET /admin/openwa/plugins/:id ─────────────────────────────────
const getOpenwaPlugin = async (req, res, next) => {
    try {
        const plugin = (0, openwa_admin_service_1.getAdminPlugin)(req.params.id);
        if (!plugin)
            return (0, apiResponse_1.fail)(res, 'Plugin not found', 404);
        return (0, apiResponse_1.ok)(res, { plugin });
    }
    catch (error) {
        next(error);
    }
};
exports.getOpenwaPlugin = getOpenwaPlugin;
// ─── PATCH /admin/openwa/plugins/:id ───────────────────────────────
const updateOpenwaPlugin = async (req, res, next) => {
    try {
        const plugin = (0, openwa_admin_service_1.updateAdminPlugin)(req.params.id, req.body || {});
        return (0, apiResponse_1.ok)(res, { plugin });
    }
    catch (error) {
        next(error);
    }
};
exports.updateOpenwaPlugin = updateOpenwaPlugin;
// ─── GET /admin/profile-requests ─────────────────────────────────────
const getProfileRequests = async (_req, res, next) => {
    try {
        const requests = await database_1.prisma.profileChangeRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { email: true, firstName: true, lastName: true, role: true } }
            }
        });
        return (0, apiResponse_1.ok)(res, { requests });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfileRequests = getProfileRequests;
// ─── PUT /admin/profile-requests/:id/approve ─────────────────────────
const approveProfileRequest = async (req, res, next) => {
    try {
        const request = await database_1.prisma.profileChangeRequest.findUnique({ where: { id: req.params.id } });
        if (!request || request.status !== 'PENDING') {
            return (0, apiResponse_1.fail)(res, 'Pending request not found', 404);
        }
        const changes = request.requestedChanges;
        const updateData = {};
        if (changes.firstName)
            updateData.firstName = changes.firstName;
        if (changes.lastName)
            updateData.lastName = changes.lastName;
        if (changes.profilePictureUrl)
            updateData.profilePictureUrl = changes.profilePictureUrl;
        await database_1.prisma.$transaction([
            database_1.prisma.user.update({ where: { id: request.userId }, data: updateData }),
            database_1.prisma.profileChangeRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } }),
        ]);
        return (0, apiResponse_1.ok)(res, { message: 'Profile change approved' });
    }
    catch (error) {
        next(error);
    }
};
exports.approveProfileRequest = approveProfileRequest;
// ─── PUT /admin/profile-requests/:id/reject ──────────────────────────
const rejectProfileRequest = async (req, res, next) => {
    try {
        const request = await database_1.prisma.profileChangeRequest.update({
            where: { id: req.params.id },
            data: { status: 'REJECTED' },
        });
        return (0, apiResponse_1.ok)(res, { request });
    }
    catch (error) {
        next(error);
    }
};
exports.rejectProfileRequest = rejectProfileRequest;
//# sourceMappingURL=admin.controller.js.map