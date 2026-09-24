"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
// ── CREATE PAYMENT ────────────────────────────────────
router.post('/create', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { amount, method, description } = req.body;
        const userId = req.user.id;
        const payment = await database_1.prisma.pakistanPayment.create({
            data: {
                userId,
                amount,
                method: method.toUpperCase(),
                description,
                status: 'PENDING',
            },
        });
        res.json({
            success: true,
            data: {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                status: payment.status,
                createdAt: payment.createdAt,
            },
        });
    }
    catch (err) {
        console.error('[PK Payment] Create error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── UPLOAD SCREENSHOT ─────────────────────────────────
router.post('/upload/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { screenshotUrl } = req.body;
        const payment = await database_1.prisma.pakistanPayment.update({
            where: { id },
            data: { screenshot: screenshotUrl },
        });
        res.json({ success: true, data: payment });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── GET USER PAYMENTS ─────────────────────────────────
router.get('/my-payments', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const payments = await database_1.prisma.pakistanPayment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ success: true, data: payments });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── ADMIN: GET ALL PENDING PAYMENTS ───────────────────
router.get('/admin/pending', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const payments = await database_1.prisma.pakistanPayment.findMany({
            where: { status: 'PENDING' },
            include: { user: { select: { email: true, firstName: true, lastName: true } } },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ success: true, data: payments });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── ADMIN: VERIFY PAYMENT ─────────────────────────────
router.post('/admin/verify/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // VERIFIED or REJECTED
        const adminId = req.user.id;
        const payment = await database_1.prisma.pakistanPayment.update({
            where: { id },
            data: {
                status,
                verifiedBy: adminId,
                verifiedAt: new Date(),
                rejectReason: status === 'REJECTED' ? reason : null,
            },
        });
        // If verified, award PAB rewards
        if (status === 'VERIFIED') {
            const pabReward = Math.round(payment.amount / 10);
            // In production: actually award PAB to user
            console.log(`[PK Payment] Awarding ${pabReward} PAB to user ${payment.userId}`);
        }
        res.json({ success: true, data: payment });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// ── ADMIN: PAYMENT STATS ──────────────────────────────
router.get('/admin/stats', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const total = await database_1.prisma.pakistanPayment.count();
        const pending = await database_1.prisma.pakistanPayment.count({ where: { status: 'PENDING' } });
        const verified = await database_1.prisma.pakistanPayment.count({ where: { status: 'VERIFIED' } });
        const rejected = await database_1.prisma.pakistanPayment.count({ where: { status: 'REJECTED' } });
        const totalAmount = await database_1.prisma.pakistanPayment.aggregate({
            where: { status: 'VERIFIED' },
            _sum: { amount: true },
        });
        res.json({
            success: true,
            data: {
                total,
                pending,
                verified,
                rejected,
                totalAmount: totalAmount._sum.amount || 0,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=pakistanPayment.routes.js.map