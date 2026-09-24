"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const openwa_webhook_manager_service_1 = require("../services/openwa.webhook-manager.service");
const openwa_webhook_handler_service_1 = require("../services/openwa.webhook-handler.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/openwa/webhook/incoming
 *
 * Receives webhook payloads from OpenWA. Verifies HMAC signature before
 * dispatching to the registered handlers.
 *
 * OpenWA sends the signature in the `X-Webhook-Signature` header as "sha256=<hex>".
 */
router.post('/incoming', async (req, res, next) => {
    try {
        const signature = req.headers['x-webhook-signature'];
        // Get raw body for HMAC verification.
        // Express json() middleware may have already parsed it, so we reconstruct
        // or rely on a raw body buffer if available.
        const rawBody = req.rawBody || JSON.stringify(req.body);
        if (!openwa_webhook_manager_service_1.webhookManager.verifySignature(rawBody, signature)) {
            logger_1.logger.warn('[WebhookController] Invalid webhook signature');
            res.status(401).json({ success: false, error: 'Invalid signature' });
            return;
        }
        const payload = req.body;
        if (!payload || !payload.event) {
            res.status(400).json({ success: false, error: 'Missing event field' });
            return;
        }
        // Respond immediately — handle asynchronously to avoid OpenWA retry on slow processing
        res.status(200).json({ success: true, received: true });
        // Dispatch in background
        openwa_webhook_manager_service_1.webhookManager.dispatch(payload).catch(error => {
            logger_1.logger.error(`[WebhookController] Dispatch error: ${error?.message || error}`);
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/openwa/webhook/status
 *
 * Returns webhook manager status: whether a webhook is registered,
 * health of the OpenWA connection, etc.
 */
router.get('/status', async (req, res, next) => {
    try {
        res.json({
            success: true,
            data: {
                callbackUrl: openwa_webhook_manager_service_1.webhookManager.callbackUrl,
                registered: !!openwa_webhook_manager_service_1.webhookManager.registeredWebhookId,
                sessionId: openwa_webhook_manager_service_1.webhookManager.sessionId,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/openwa/webhook/ack/:messageId
 *
 * Look up delivery receipt status for a message.
 */
router.get('/ack/:messageId', (req, res) => {
    const record = (0, openwa_webhook_handler_service_1.getMessageAck)(req.params.messageId);
    res.json({
        success: true,
        data: record || { messageId: req.params.messageId, ack: null, status: 'unknown' },
    });
});
exports.default = router;
//# sourceMappingURL=openwa.webhook.routes.js.map