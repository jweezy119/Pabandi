"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
function getUserId(req) {
    return req.user.id;
}
// ── GET /api/v1/notifications ───────────────────────────────────────────────
// Get notifications for the authenticated user (paginated)
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { page = '1', limit = '20', filter = 'all' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50);
        const skip = (pageNum - 1) * limitNum;
        const where = { userId };
        if (filter === 'unread')
            where.read = false;
        const [notifications, total, unreadCount] = await Promise.all([
            database_1.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
            database_1.prisma.notification.count({ where }),
            database_1.prisma.notification.count({ where: { userId, read: false } }),
        ]);
        res.json({
            success: true,
            data: notifications,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
            unreadCount,
        });
    }
    catch (e) {
        logger_1.logger.error('Notifications fetch failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/notifications/unread-count ──────────────────────────────────
router.get('/unread-count', async (req, res) => {
    try {
        const userId = getUserId(req);
        const count = await database_1.prisma.notification.count({ where: { userId, read: false } });
        res.json({ success: true, count });
    }
    catch (e) {
        logger_1.logger.error('Unread count fetch failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── PATCH /api/v1/notifications/:id/read ────────────────────────────────────
// Mark a single notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const notification = await database_1.prisma.notification.findUnique({ where: { id } });
        if (!notification || notification.userId !== userId) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        const updated = await database_1.prisma.notification.update({
            where: { id },
            data: { read: true },
        });
        res.json({ success: true, data: updated });
    }
    catch (e) {
        logger_1.logger.error('Mark read failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/notifications/read-all ─────────────────────────────────────
// Mark all notifications as read
router.post('/read-all', async (req, res) => {
    try {
        const userId = getUserId(req);
        await database_1.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
        res.json({ success: true, message: 'All notifications marked as read' });
    }
    catch (e) {
        logger_1.logger.error('Mark all read failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── POST /api/v1/notifications ──────────────────────────────────────────────
// Create a notification (internal use by services)
router.post('/', async (req, res) => {
    try {
        const { userId, type, title, body, actionUrl } = req.body;
        if (!userId || !type || !title) {
            return res.status(400).json({ success: false, error: 'userId, type, and title are required' });
        }
        const notification = await database_1.prisma.notification.create({
            data: { userId, type, title, body, actionUrl },
        });
        res.json({ success: true, data: notification });
    }
    catch (e) {
        logger_1.logger.error('Notification create failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map