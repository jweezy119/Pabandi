"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const offramp_service_1 = require("../services/offramp.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * Stage A: Mock EMI Webhook receiver
 * In production, this would verify HMAC signatures from JazzCash/NayaPay.
 */
router.post('/emi', async (req, res) => {
    try {
        const payload = req.body;
        logger_1.logger.info(`[Webhook] Received EMI webhook payload`, payload);
        const intentId = req.query.intentId;
        if (!intentId) {
            return res.status(400).json({ error: 'Missing intentId in query parameters' });
        }
        // In a real scenario, the EMI might just send the bank account and amount,
        // and we would have to query the DB for an intent matching those details.
        // For this mock, we assume the webhook includes the intentId (e.g. passed as a callback parameter).
        const success = await offramp_service_1.offrampService.processWebhookMatch(intentId, payload);
        if (success) {
            return res.status(200).json({ success: true, message: 'Intent settled via webhook' });
        }
        else {
            return res.status(400).json({ success: false, message: 'Webhook failed to match or intent invalid' });
        }
    }
    catch (error) {
        logger_1.logger.error(`[Webhook] EMI Error: ${error.message}`);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
exports.default = router;
//# sourceMappingURL=offramp-webhook.routes.js.map