"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fireWebhooks = fireWebhooks;
exports.logActivity = logActivity;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
/**
 * Fire webhooks for a given manager when a CRM event occurs.
 * Best-effort: failures are logged and counted but never block the caller.
 */
async function fireWebhooks(managerId, event, payload) {
    try {
        const webhooks = await prisma.propertyWebhook.findMany({
            where: { managerId, active: true },
        });
        for (const wh of webhooks) {
            // Filter by event type.
            if (!wh.events.includes('all') && !wh.events.includes(event))
                continue;
            // Sign the payload so the receiver can verify it came from Pabandi.
            const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
            const signature = crypto_1.default.createHmac('sha256', wh.secret).update(body).digest('hex');
            fetch(wh.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Pabandi-Signature': signature, 'X-Pabandi-Event': event },
                body,
            })
                .then(async (r) => {
                await prisma.propertyWebhook.update({
                    where: { id: wh.id },
                    data: { lastDeliveredAt: new Date(), lastStatus: String(r.status) },
                });
                if (!r.ok)
                    logger_1.logger.warn(`[pm-webhook] ${wh.url} returned ${r.status} for ${event}`);
            })
                .catch(async (e) => {
                await prisma.propertyWebhook.update({
                    where: { id: wh.id },
                    data: { lastDeliveredAt: new Date(), lastStatus: 'ERROR', failCount: { increment: 1 } },
                });
                logger_1.logger.warn(`[pm-webhook] ${wh.url} failed for ${event}: ${e.message}`);
            });
        }
    }
    catch (e) {
        logger_1.logger.error(`[pm-webhook] fireWebhooks failed: ${e.message}`);
    }
}
/**
 * Record an activity in the CRM audit log.
 */
async function logActivity(managerId, action, entityType, entityId, description, metadata) {
    try {
        await prisma.propertyActivity.create({
            data: { managerId, action, entityType, entityId, description, metadata: metadata || null },
        });
    }
    catch (e) {
        logger_1.logger.warn(`[pm-activity] logActivity failed: ${e.message}`);
    }
}
//# sourceMappingURL=pmWebhook.service.js.map