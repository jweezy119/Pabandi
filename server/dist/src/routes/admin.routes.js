"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const admin_controller_1 = require("../controllers/admin.controller");
const openwa_admin_service_1 = require("../services/openwa_admin.service");
const router = (0, express_1.Router)();
// All admin routes require auth + ADMIN role
router.use(auth_middleware_1.authenticate);
router.use((req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
});
router.get('/stats', admin_controller_1.getAdminStats);
router.get('/users', admin_controller_1.getAllUsers);
router.get('/users/:id', admin_controller_1.getUserDetail);
router.patch('/users/:id/role', admin_controller_1.updateUserRole);
router.get('/reservations', admin_controller_1.getAllReservations);
router.get('/businesses', admin_controller_1.getAllBusinesses);
router.patch('/businesses/:id/verify', admin_controller_1.verifyBusiness);
router.get('/profile-requests', admin_controller_1.getProfileRequests);
router.put('/profile-requests/:id/approve', admin_controller_1.approveProfileRequest);
router.put('/profile-requests/:id/reject', admin_controller_1.rejectProfileRequest);
router.get('/openwa/plugins', (_req, res, next) => {
    try {
        const plugins = (0, openwa_admin_service_1.listAdminPlugins)();
        res.json({ success: true, data: { plugins, source: 'openwa_catalog' } });
    }
    catch (error) {
        next(error);
    }
});
router.get('/openwa/plugins/:id', (req, res, next) => {
    try {
        const plugin = (0, openwa_admin_service_1.getAdminPlugin)(req.params.id);
        if (!plugin) {
            return res.status(404).json({ success: false, message: 'Plugin not found' });
        }
        res.json({ success: true, data: { plugin } });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/openwa/plugins/:id', (req, res, next) => {
    try {
        const plugin = (0, openwa_admin_service_1.updateAdminPlugin)(req.params.id, req.body || {});
        res.json({ success: true, data: { plugin } });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map