"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.post('/', express_2.default.raw({ type: 'application/json', verify: (req, _res, buf) => { req.rawBody = buf; } }), async (req, res, next) => {
    try {
        const rawBody = req.rawBody || Buffer.from('');
        let payload = {};
        try {
            payload = JSON.parse(rawBody.toString('utf-8') || '{}');
        }
        catch (parseError) {
            logger_1.logger.warn('[EscrowWebhook] Invalid JSON received');
            return res.status(200).json({ received: true });
        }
        const eventType = String(payload?.event || payload?.event_type || '');
        const escrowTransactionId = String(payload?.transaction_id || payload?.transactionId || '');
        const rawStatus = String(payload?.status || eventType || 'unknown');
        const escrowId = String(payload?.id || '');
        if (!escrowTransactionId) {
            return res.status(200).json({ received: true });
        }
        const normalizedEvent = eventType || 'unknown';
        const normalizedLower = rawStatus.toLowerCase();
        let mappedStatus = 'PENDING';
        if (normalizedLower.includes('release') ||
            normalizedLower.includes('completed') ||
            normalizedLower.includes('complete')) {
            mappedStatus = 'RELEASED';
        }
        else if (normalizedLower.includes('cancel') ||
            normalizedLower.includes('cancelled') ||
            normalizedLower.includes('refunded')) {
            mappedStatus = 'CANCELLED';
        }
        else if (normalizedLower.includes('dispute') ||
            normalizedLower.includes('chargeback')) {
            mappedStatus = 'DISPUTED';
        }
        else if (normalizedLower.includes('fund') ||
            normalizedLower.includes('approved') ||
            normalizedLower.includes('paid') ||
            normalizedLower.includes('received')) {
            mappedStatus = 'FUNDED';
        }
        await database_1.prisma.$transaction(async (tx) => {
            let session = await tx.checkoutSession.findFirst({
                where: {
                    OR: [
                        { metadata: { path: ['escrowTransactionId'], equals: escrowTransactionId } },
                        ...(escrowId ? [{ metadata: { path: ['escrowId'], equals: escrowId } }] : []),
                    ],
                },
            });
            if (!session) {
                logger_1.logger.warn('[EscrowWebhook] No session found for transactionId=%s escrowId=%s', escrowTransactionId, escrowId);
                return;
            }
            const isTerminal = ['RELEASED', 'CANCELLED', 'DISPUTED'].includes(mappedStatus);
            const newStatus = isTerminal ? mappedStatus : session.status;
            await tx.escrowEvent.create({
                data: {
                    checkoutSessionId: session.id,
                    escrowTransactionId,
                    eventType: normalizedEvent,
                    status: mappedStatus,
                    payload,
                },
            });
            await tx.checkoutSession.update({
                where: { id: session.id },
                data: {
                    status: newStatus,
                    metadata: {
                        ...(session.metadata || {}),
                        escrowTransactionId,
                        ...(escrowId ? { escrowId } : {}),
                        lastEscrowEvent: normalizedEvent,
                    },
                },
            });
            logger_1.logger.info('[EscrowWebhook] Persisted event=%s transactionId=%s session=%s', eventType, escrowTransactionId, session.id);
        });
        return res.status(200).json({ received: true });
    }
    catch (error) {
        logger_1.logger.error('[EscrowWebhook] Processing error: %s', error?.message || error);
        return res.status(200).json({ received: true });
    }
});
router.get('/receipt/:escrowTransactionId', async (req, res, next) => {
    try {
        const { escrowTransactionId } = req.params;
        const events = await database_1.prisma.escrowEvent.findMany({
            where: { escrowTransactionId },
            orderBy: { createdAt: 'asc' },
        });
        if (!events.length) {
            // fallback: lookup by recent matching metadata to support manual lookup
            const candidate = await database_1.prisma.checkoutSession.findFirst({
                where: { metadata: { path: ['escrowTransactionId'], equals: escrowTransactionId } },
                orderBy: { createdAt: 'desc' },
            });
            if (!candidate) {
                return res.status(404).json({ success: false, message: 'No settlement receipt found' });
            }
            const latest = await database_1.prisma.escrowEvent.findFirst({
                where: { checkoutSessionId: candidate.id },
                orderBy: { createdAt: 'desc' },
            });
            return res.status(200).json({
                success: true,
                data: {
                    checkoutSessionId: candidate.id,
                    escrowTransactionId,
                    status: candidate.status,
                    lastEvent: latest || null,
                },
            });
        }
        const latestEvent = events[events.length - 1];
        const checkoutSessionId = latestEvent.checkoutSessionId;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id: checkoutSessionId },
        });
        return res.status(200).json({
            success: true,
            data: {
                checkoutSessionId,
                escrowTransactionId,
                status: session?.status || latestEvent.status,
                eventCount: events.length,
                lastEvent: latestEvent,
                events,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=webhook.escrow.routes.js.map