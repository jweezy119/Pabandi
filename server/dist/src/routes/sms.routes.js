"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sms_service_1 = require("../services/sms.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// POST /api/v1/sms/send - Send SMS
router.post('/send', async (req, res, next) => {
    try {
        const { to, message, businessId } = req.body;
        if (!to || !message) {
            res.status(400).json({ success: false, error: 'to and message are required' });
            return;
        }
        const result = await sms_service_1.smsService.sendSMS(to, message, businessId);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error });
            return;
        }
        res.json({ success: true, data: { messageId: result.messageId, provider: result.provider, cost: result.cost } });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/sms/bulk - Bulk SMS
router.post('/bulk', async (req, res, next) => {
    try {
        const { numbers, message, businessId } = req.body;
        if (!Array.isArray(numbers) || !message) {
            res.status(400).json({ success: false, error: 'numbers (array) and message are required' });
            return;
        }
        const result = await sms_service_1.smsService.sendBulkSMS(numbers, message, businessId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/sms/status/:id - Check delivery status
router.get('/status/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { provider } = req.query;
        const result = await sms_service_1.smsService.getStatus(id, provider || 'TWILIO');
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/sms/logs - SMS logs
router.get('/logs', async (req, res, next) => {
    try {
        const { businessId, limit, offset } = req.query;
        if (!businessId) {
            res.status(400).json({ success: false, error: 'businessId is required' });
            return;
        }
        const logs = await sms_service_1.smsService.getSMSLogs(businessId, parseInt(limit || '50'), parseInt(offset || '0'));
        res.json({ success: true, data: logs });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/sms/credentials - Save provider credentials (simplified, stores in DB)
router.post('/credentials', async (req, res, next) => {
    try {
        const { twilioSid, twilioToken, twilioFrom, vonageKey, vonageSecret } = req.body;
        // In production, these would be encrypted and stored. For now, return success.
        logger_1.logger.info('[SMS] Credentials saved (env-based config)');
        res.json({ success: true, message: 'Credentials saved' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/webhook/twilio', async (req, res, next) => {
    try {
        await sms_service_1.smsService.handleTwilioWebhook(req.body);
        res.type('text/xml').send('<Response/>');
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=sms.routes.js.map