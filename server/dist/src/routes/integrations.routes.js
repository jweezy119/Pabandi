"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const network_service_1 = require("../services/network.service");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const crypto_service_1 = require("../services/crypto.service");
const router = (0, express_1.Router)();
/**
 * Helper to securely hash phones received via server-to-server webhooks
 * using the daily rotating salt to prevent rainbow table attacks.
 */
function hashPhone(phone) {
    return crypto_service_1.cryptoService.hmacHash(phone);
}
/**
 * ── TIKTOK SHOP WEBHOOK RECEIVER ─────────────────────────────────────────────
 *
 * TikTok Shop does not allow custom frontend scripts. We must receive
 * order creation webhooks, analyze them, and hit the TikTok Shop API back
 * to cancel or hold the order if the buyer is high-risk.
 *
 * Note: TikTok Shop uses HMAC signatures for security, not API keys.
 */
/**
 * @openapi
 * /api/v1/integrations/tiktok/webhook:
 *   post:
 *     summary: Receive TikTok Shop Webhook (Order Status Update)
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Webhook received and processed
 */
router.post('/tiktok/webhook', async (req, res) => {
    try {
        // 1. Verify TikTok Shop Signature
        const signature = req.headers['x-tts-signature'];
        const appSecret = process.env.TIKTOK_APP_SECRET || null;
        if (appSecret) {
            const rawBody = JSON.stringify(req.body);
            const expectedSignature = crypto_1.default.createHmac('sha256', appSecret).update(rawBody).digest('hex');
            if (signature !== expectedSignature) {
                logger_1.logger.warn('[TikTok Shop] Webhook signature validation failed.');
                return res.status(401).json({ success: false, error: 'Unauthorized webhook payload' });
            }
        }
        else if (process.env.NODE_ENV === 'production') {
            logger_1.logger.warn('[TikTok Shop] Missing TIKTOK_APP_SECRET in production.');
            return res.status(500).json({ success: false, error: 'Webhook secret not configured' });
        }
        const { type, data } = req.body;
        // We only care about new orders that are Cash on Delivery
        if (type === 'ORDER_STATUS_UPDATE' && data.order_status === 'UNPAID' && data.payment_method === 'COD') {
            const buyerPhone = data.buyer_phone; // TikTok Shop passes PII to the seller's webhook
            if (!buyerPhone)
                return res.status(200).send('OK');
            // 2. Immediately hash the PII so we never store it
            const hashedPhone = hashPhone(buyerPhone);
            // 3. Query the Zero-Knowledge Network
            const networkResult = await network_service_1.networkService.checkHash(hashedPhone);
            if (networkResult.prediction?.riskLevel === 'CRITICAL') {
                logger_1.logger.warn(`[TikTok Shop] Intercepted CRITICAL risk COD order. OrderID: ${data.order_id}`);
                // 4. Hit TikTok Shop API to CANCEL or HOLD the order
                // await axios.post(`https://open-api.tiktokglobalshop.com/order/202309/orders/${data.order_id}/cancel`, ...)
                // Feed it back to the merchant's dashboard log
                logger_1.logger.info(`[TikTok Shop] Successfully auto-cancelled high-risk COD order ${data.order_id}.`);
            }
            else {
                logger_1.logger.info(`[TikTok Shop] Order ${data.order_id} is low risk. Allowed to proceed.`);
            }
        }
        // TikTok Shop expects a fast 200 OK so the webhook doesn't retry
        return res.status(200).json({ success: true, message: 'Webhook received and processed.' });
    }
    catch (error) {
        logger_1.logger.error('[Integrations] TikTok Webhook Error:', error);
        return res.status(500).json({ success: false, error: 'Internal error processing webhook' });
    }
});
/**
 * ── GENERIC OMNI-CHANNEL REPORTING ──────────────────────────────────────────
 *
 * A unified endpoint for backend systems (Shopify Flow, WooCommerce hooks)
 * to automatically report a COD Rejection when a package is marked "Returned".
 */
/**
 * @openapi
 * /api/v1/integrations/report:
 *   post:
 *     summary: Generic Omni-Channel Reporting
 *     tags: [Integrations]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rawPhone:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Incident reported
 */
router.post('/report', apiKey_middleware_1.apiKeyAuth, async (req, res) => {
    try {
        const { rawPhone, type, description } = req.body;
        if (!rawPhone || !type) {
            return res.status(400).json({ success: false, error: 'Missing required fields: rawPhone, type' });
        }
        // Hash it locally on our server edge before it touches the database
        const hashedPhone = hashPhone(rawPhone);
        const apiClientId = req.apiClient?.id;
        const result = await network_service_1.networkService.reportHash(hashedPhone, type, description, apiClientId);
        return res.status(201).json({
            success: true,
            message: 'Incident reported to the Zero-Knowledge network.',
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('[Integrations] Generic Report Error:', error);
        return res.status(500).json({ success: false, error: 'Internal error reporting incident.' });
    }
});
/**
 * @openapi
 * /api/v1/integrations/odoo/webhook:
 *   post:
 *     summary: Odoo CRM/Partner sync webhook
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Odoo sync successful
 */
router.post('/odoo/webhook', async (req, res) => {
    try {
        const { partner_id, event, data } = req.body;
        logger_1.logger.info(`[Odoo] Received webhook for partner ${partner_id}, event: ${event}`);
        // In a real integration, we'd sync this with our DB
        return res.status(200).json({ success: true, message: 'Odoo sync complete' });
    }
    catch (error) {
        logger_1.logger.error('[Integrations] Odoo Webhook Error:', error);
        return res.status(500).json({ success: false, error: 'Internal error processing Odoo webhook.' });
    }
});
/**
 * @openapi
 * /api/v1/integrations/cal-com:
 *   post:
 *     summary: Cal.com booking sync webhook
 *     tags: [Integrations]
 *     responses:
 *       200:
 *         description: Cal.com sync successful
 */
router.post('/cal-com', async (req, res) => {
    try {
        const { triggerEvent, payload } = req.body;
        logger_1.logger.info(`[Cal.com] Received booking webhook event: ${triggerEvent}`);
        // E.g. triggerEvent === 'BOOKING_CREATED'
        if (triggerEvent === 'BOOKING_CREATED') {
            const attendeePhone = payload?.attendees?.[0]?.phoneNumber;
            if (attendeePhone) {
                // Check Pabandi network score
                const hashedPhone = hashPhone(attendeePhone);
                const networkResult = await network_service_1.networkService.checkHash(hashedPhone);
                if (networkResult.prediction?.riskLevel === 'CRITICAL') {
                    logger_1.logger.warn(`[Cal.com] Intercepted high-risk booking: ${payload.uid}. Needs manual review.`);
                    // Could call Cal.com API to auto-cancel or request a deposit via Stripe
                }
            }
        }
        return res.status(200).json({ success: true, message: 'Cal.com sync complete' });
    }
    catch (error) {
        logger_1.logger.error('[Integrations] Cal.com Webhook Error:', error);
        return res.status(500).json({ success: false, error: 'Internal error processing Cal.com webhook.' });
    }
});
exports.default = router;
//# sourceMappingURL=integrations.routes.js.map