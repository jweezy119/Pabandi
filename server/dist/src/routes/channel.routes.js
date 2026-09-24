"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const channelRouter_service_1 = require("../services/channelRouter.service");
const router = (0, express_1.Router)();
// POST /api/v1/channels/route - Route message to best channel
router.post('/route', async (req, res, next) => {
    try {
        const { businessId, customerId, message, channels, parse_mode, buttons } = req.body;
        if (!businessId || !customerId || !message) {
            res.status(400).json({ success: false, error: 'businessId, customerId, and message are required' });
            return;
        }
        const result = await channelRouter_service_1.channelRouter.routeMessage(businessId, customerId, message, channels, { parse_mode, buttons });
        if (!result.success) {
            res.status(502).json({ success: false, error: result.error, channel: result.channel });
            return;
        }
        res.json({ success: true, data: { channel: result.channel, messageId: result.messageId } });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/channels/fallback - Fallback to next channel
router.post('/fallback', async (req, res, next) => {
    try {
        const { businessId, customerId, message, from, to, parse_mode, buttons } = req.body;
        if (!businessId || !customerId || !message || !from || !to) {
            res.status(400).json({ success: false, error: 'businessId, customerId, message, from, and to are required' });
            return;
        }
        const result = await channelRouter_service_1.channelRouter.fallback(businessId, customerId, message, from, to, { parse_mode, buttons });
        if (!result.success) {
            res.status(502).json({ success: false, error: result.error, channel: result.channel });
            return;
        }
        res.json({ success: true, data: { channel: result.channel, messageId: result.messageId } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/channels/:businessId/messages - Unified inbox
router.get('/:businessId/messages', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { channel, status, limit, offset } = req.query;
        const messages = await channelRouter_service_1.channelRouter.getUnifiedInbox(businessId, {
            channel,
            status,
            limit: parseInt(limit || '50'),
            offset: parseInt(offset || '0'),
        });
        res.json({ success: true, data: messages });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/channels/:businessId/stats - Channel analytics
router.get('/:businessId/stats', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { startDate, endDate } = req.query;
        const stats = await channelRouter_service_1.channelRouter.getChannelStats(businessId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/channels/:businessId/best-times - Best time to send
router.get('/:businessId/best-times', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const bestTimes = await channelRouter_service_1.channelRouter.getBestTimeToSend(businessId);
        res.json({ success: true, data: bestTimes });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=channel.routes.js.map