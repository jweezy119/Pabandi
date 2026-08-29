"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * webhook.routes.ts — admin webhook delivery endpoints.
 *
 *   POST /api/v1/webhooks/deliver/now  — force process webhook queue
 *   GET  /api/v1/webhooks/queue        — view pending webhooks
 */
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const webhookDelivery_service_1 = require("../services/webhookDelivery.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.use((0, auth_middleware_1.authorize)('ADMIN'));
router.post('/deliver/now', async (_req, res) => {
    try {
        const result = await webhookDelivery_service_1.webhookDeliveryService.processWebhookQueue();
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/queue', async (_req, res) => {
    try {
        const [pending, delivered] = await Promise.all([
            database_1.prisma.webhookDelivery.count({ where: { status: 'QUEUED' } }),
            database_1.prisma.webhookDelivery.count({ where: { status: 'DELIVERED' } }),
        ]);
        res.json({ success: true, data: { pending, delivered } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map