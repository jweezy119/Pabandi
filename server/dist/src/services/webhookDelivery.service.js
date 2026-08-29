"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookDeliveryService = void 0;
exports.enqueueWebhook = enqueueWebhook;
exports.processWebhookQueue = processWebhookQueue;
/**
 * webhookDelivery.service.ts — reliable webhook delivery for app integrations.
 *
 * When an app connects via POST /api/v1/apps/connect it can register a webhookUrl.
 * This service queues + retries webhook delivery for:
 *   - booking outcomes
 *   - agent trust updates
 *   - PTP attestation issuance
 *   - treasury events
 */
const database_1 = require("../utils/database");
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 10000;
async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
async function deliverOnce(url, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Pabandi-Webhook/1.0' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        return resp.ok;
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timer);
    }
}
async function enqueueWebhook(opts) {
    const app = await database_1.prisma.appConnection.findUnique({
        where: { id: opts.appId },
        select: { id: true, webhookUrl: true, status: true },
    });
    if (!app?.webhookUrl || app.status !== 'ACTIVE')
        return;
    await database_1.prisma.webhookDelivery.create({
        data: {
            appId: opts.appId,
            event: opts.event,
            payload: opts.data,
            status: 'QUEUED',
            attempts: 0,
        },
    });
}
async function processWebhookQueue() {
    const pending = await database_1.prisma.webhookDelivery.findMany({
        where: { status: { not: 'DELIVERED' } },
        orderBy: { createdAt: 'asc' },
        take: 50,
    });
    let delivered = 0;
    let failed = 0;
    for (const wh of pending) {
        const app = await database_1.prisma.appConnection.findUnique({
            where: { id: wh.appId },
            select: { webhookUrl: true, status: true },
        });
        if (!app?.webhookUrl || app.status !== 'ACTIVE') {
            await database_1.prisma.webhookDelivery.update({ where: { id: wh.id }, data: { status: 'SKIPPED' } });
            failed++;
            continue;
        }
        let ok = false;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            ok = await deliverOnce(app.webhookUrl, { event: wh.event, data: wh.payload, deliveredAt: new Date().toISOString() });
            if (ok)
                break;
            await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
        await database_1.prisma.webhookDelivery.update({
            where: { id: wh.id },
            data: {
                status: ok ? 'DELIVERED' : 'FAILED',
                attempts: { increment: 1 },
                lastAttemptAt: new Date(),
                nextAttemptAt: ok ? null : new Date(Date.now() + RETRY_DELAY_MS * 2),
            },
        });
        if (ok)
            delivered++;
        else
            failed++;
    }
    return { delivered, failed };
}
exports.webhookDeliveryService = { enqueueWebhook, processWebhookQueue };
//# sourceMappingURL=webhookDelivery.service.js.map