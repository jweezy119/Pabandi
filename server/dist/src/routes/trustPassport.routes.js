"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Trust Passport routes — public portable trust identity.
 *   GET  /api/v1/trust-passport/directory -> public discovery list (no auth)
 *   GET  /api/v1/trust-passport/:handle    -> public snapshot (no auth)
 *   POST /api/v1/trust-passport           -> create/update (auth)
 *   GET  /api/v1/trust-passport/:handle/request -> context for PPD wizard pre-fill
 *   POST /api/v1/trust-passport/migrate    -> create table (Cloud Run FS read-only)
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const trustPassport_service_1 = require("../services/trustPassport.service");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
router.get('/directory', async (req, res) => {
    try {
        const list = await trustPassport_service_1.trustPassportService.list({
            category: req.query.category,
            search: req.query.search,
            limit: req.query.limit ? Number(req.query.limit) : 50,
        });
        res.json({ success: true, data: list, count: list.length });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.post('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { handle, displayName, category, agentId, providerRef, bio, walletAddress } = req.body ?? {};
        if (!handle || !displayName)
            return res.status(400).json({ success: false, error: 'handle, displayName required' });
        const p = await trustPassport_service_1.trustPassportService.upsert({ handle, displayName, category, agentId, providerRef, bio, walletAddress });
        res.json({ success: true, data: p });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/:handle', async (req, res) => {
    try {
        const snap = await trustPassport_service_1.trustPassportService.getPublic(req.params.handle);
        res.json({ success: true, data: snap });
    }
    catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});
router.get('/:handle/request', async (req, res) => {
    try {
        const ctx = await trustPassport_service_1.trustPassportService.getRequestContext(req.params.handle);
        res.json({ success: true, data: ctx });
    }
    catch (e) {
        res.status(404).json({ success: false, error: e.message });
    }
});
router.get('/me', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        let passport = await database_1.prisma.trustPassport.findFirst({ where: { userId } });
        if (!passport) {
            const handle = `user-${userId.slice(0, 8)}`;
            passport = await database_1.prisma.trustPassport.create({
                data: {
                    userId,
                    handle,
                    displayName: req.user?.firstName || 'User',
                    visibility: 'PRIVATE',
                },
            });
        }
        res.json({ success: true, data: passport });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/user/:userId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const passport = await database_1.prisma.trustPassport.findFirst({ where: { userId: targetUserId } });
        if (!passport)
            return res.status(404).json({ success: false, error: 'Passport not found' });
        if (passport.visibility === 'PRIVATE') {
            return res.status(403).json({ success: false, error: 'Passport is private' });
        }
        res.json({ success: true, data: passport });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.put('/privacy', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { visibility, privacySettings } = req.body ?? {};
        const passport = await database_1.prisma.trustPassport.findFirst({ where: { userId } });
        if (!passport)
            return res.status(404).json({ success: false, error: 'Passport not found' });
        const updated = await database_1.prisma.trustPassport.update({
            where: { id: passport.id },
            data: { visibility, privacySettings },
        });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=trustPassport.routes.js.map