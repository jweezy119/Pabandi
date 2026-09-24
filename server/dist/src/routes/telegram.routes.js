"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const telegram_service_1 = require("../services/telegram.service");
const router = (0, express_1.Router)();
// POST /api/v1/telegram/setup - Setup bot with token
router.post('/setup', async (req, res, next) => {
    try {
        const { businessId, botToken } = req.body;
        if (!businessId || !botToken) {
            res.status(400).json({ success: false, error: 'businessId and botToken are required' });
            return;
        }
        // Validate token format (basic check)
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) {
            res.status(400).json({ success: false, error: 'Invalid bot token format' });
            return;
        }
        // Initialize bot
        const result = await telegram_service_1.telegramService.initialize(botToken, businessId);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error || 'Failed to initialize bot' });
            return;
        }
        // Save/update in DB
        await database_1.prisma.telegramBot.upsert({
            where: { businessId },
            update: { botToken, botUsername: result.username, isActive: true },
            create: { businessId, botToken, botUsername: result.username, isActive: true },
        });
        res.json({ success: true, data: { botUsername: result.username, isActive: true } });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/telegram/:businessId/send - Send message
router.post('/:businessId/send', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { chatId, message, parse_mode, buttons } = req.body;
        if (!chatId || !message) {
            res.status(400).json({ success: false, error: 'chatId and message are required' });
            return;
        }
        let result;
        if (buttons && Array.isArray(buttons)) {
            result = await telegram_service_1.telegramService.sendInlineKeyboard(businessId, chatId, message, buttons);
        }
        else {
            result = await telegram_service_1.telegramService.sendMessage(businessId, chatId, message, { parse_mode });
        }
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error });
            return;
        }
        res.json({ success: true, data: { messageId: result.messageId } });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/telegram/:businessId/broadcast - Broadcast to multiple chats
router.post('/:businessId/broadcast', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const { chatIds, message, parse_mode } = req.body;
        if (!Array.isArray(chatIds) || !message) {
            res.status(400).json({ success: false, error: 'chatIds (array) and message are required' });
            return;
        }
        const results = [];
        for (const chatId of chatIds) {
            const result = await telegram_service_1.telegramService.sendMessage(businessId, chatId, message, { parse_mode });
            results.push({ chatId, ...result });
        }
        const successCount = results.filter(r => r.success).length;
        res.json({ success: true, data: { total: chatIds.length, sent: successCount, results } });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/telegram/webhook/:botToken - Incoming messages (long-polling fallback + webhook support)
router.post('/webhook/:botToken', async (req, res, next) => {
    try {
        const { botToken } = req.params;
        const update = req.body;
        // Find business by token
        const botRecord = await database_1.prisma.telegramBot.findFirst({ where: { botToken } });
        if (!botRecord) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }
        await telegram_service_1.telegramService.handleUpdate(botRecord.businessId, update);
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/telegram/:businessId/status - Bot status
router.get('/:businessId/status', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const dbRecord = await database_1.prisma.telegramBot.findUnique({ where: { businessId } });
        const runtimeInfo = await telegram_service_1.telegramService.getBotInfo(businessId);
        res.json({
            success: true,
            data: {
                isActive: runtimeInfo.isActive,
                username: dbRecord?.botUsername,
                dbActive: dbRecord?.isActive,
                configured: !!dbRecord,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/v1/telegram/:businessId - Disable bot
router.delete('/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        await telegram_service_1.telegramService.stopBot(businessId);
        await database_1.prisma.telegramBot.updateMany({
            where: { businessId },
            data: { isActive: false },
        });
        res.json({ success: true, message: 'Bot disabled' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=telegram.routes.js.map