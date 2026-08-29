"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamLpIntents = exports.createSettlementReceipt = exports.emiWebhook = exports.testWebhookDelivery = exports.registerProvider = exports.listProviders = exports.expireStaleIntents = exports.acceptProof = exports.getIntents = exports.submitProof = exports.matchLp = exports.createIntent = void 0;
const database_1 = require("../utils/database");
const offramp_service_1 = require("../services/offramp.service");
const webhook_service_1 = require("../services/webhook.service");
const apiResponse_1 = require("../utils/apiResponse");
const createIntent = async (req, res, next) => {
    try {
        const { customerWallet, amountUsdc, minRatePkr, destinationType, destinationRef, businessId, lockedTxHash, idempotencyKey, } = req.body;
        if (!customerWallet || !destinationType || !destinationRef) {
            return (0, apiResponse_1.fail)(res, 'customerWallet, destinationType, and destinationRef are required', 400);
        }
        if (!amountUsdc || Number(amountUsdc) <= 0) {
            return (0, apiResponse_1.fail)(res, 'amountUsdc must be greater than 0', 400);
        }
        const intent = await offramp_service_1.offrampService.requestIntent(String(customerWallet), Number(amountUsdc), Number(minRatePkr || 0), String(destinationType), String(destinationRef), businessId ? String(businessId) : undefined, idempotencyKey ? String(idempotencyKey) : undefined);
        return (0, apiResponse_1.ok)(res, { intent });
    }
    catch (error) {
        next(error);
    }
};
exports.createIntent = createIntent;
const matchLp = async (req, res, next) => {
    try {
        const { intentId } = req.params;
        // Wait, matchLp in service doesn't take lpWallet as param?
        // Let's pass it anyway or remove it if not needed.
        const intent = await offramp_service_1.offrampService.matchLp(intentId);
        return (0, apiResponse_1.ok)(res, { intent });
    }
    catch (error) {
        next(error);
    }
};
exports.matchLp = matchLp;
const submitProof = async (req, res, next) => {
    try {
        const { intentId } = req.params;
        const { lpWallet, imageBase64 } = req.body;
        const proof = await offramp_service_1.offrampService.submitProof(intentId, String(lpWallet || ''), String(imageBase64 || ''));
        return (0, apiResponse_1.ok)(res, { proof });
    }
    catch (error) {
        next(error);
    }
};
exports.submitProof = submitProof;
const getIntents = async (req, res, next) => {
    try {
        const { status, before, limit, destinationType } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (destinationType)
            where.destinationType = destinationType;
        if (before)
            where.requestedAt = { lt: new Date(String(before)) };
        const intents = await database_1.prisma.offrampIntent.findMany({
            where,
            take: Number(limit) || 20,
            orderBy: { requestedAt: 'desc' },
        });
        return (0, apiResponse_1.ok)(res, { intents });
    }
    catch (error) {
        next(error);
    }
};
exports.getIntents = getIntents;
const acceptProof = async (req, res, next) => {
    try {
        const { intentId, proofId } = req.body;
        if (!intentId || !proofId)
            return (0, apiResponse_1.fail)(res, 'intentId and proofId are required', 400);
        await offramp_service_1.offrampService.acceptProof(intentId);
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        return (0, apiResponse_1.ok)(res, { intent });
    }
    catch (error) {
        next(error);
    }
};
exports.acceptProof = acceptProof;
const expireStaleIntents = async (_req, res, next) => {
    try {
        const expiredCount = await offramp_service_1.offrampService.expireStaleIntents();
        return (0, apiResponse_1.ok)(res, { expiredCount });
    }
    catch (error) {
        next(error);
    }
};
exports.expireStaleIntents = expireStaleIntents;
const listProviders = async (_req, res, next) => {
    try {
        const providers = await database_1.prisma.liquidityProvider.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                walletAddress: true,
                displayName: true,
                raastId: true,
                jazzCashAccount: true,
                bankIban: true,
                pkrReserveUsd: true,
                collateralUsdc: true,
                trustScore: true,
                tier: true,
                maxSingleUsdc: true,
                dailyLimitUsdc: true,
                isActive: true,
                createdAt: true,
            },
        });
        return (0, apiResponse_1.ok)(res, { providers });
    }
    catch (error) {
        next(error);
    }
};
exports.listProviders = listProviders;
const registerProvider = async (req, res, next) => {
    try {
        const { walletAddress, displayName, raastId, jazzCashAccount, bankIban, pkrReserveUsd, collateralUsdc, maxSingleUsdc, dailyLimitUsdc, } = req.body;
        if (!walletAddress)
            return (0, apiResponse_1.fail)(res, 'walletAddress is required', 400);
        const provider = await database_1.prisma.liquidityProvider.create({
            data: {
                walletAddress: String(walletAddress),
                displayName: displayName ? String(displayName) : null,
                raastId: raastId ? String(raastId) : null,
                jazzCashAccount: jazzCashAccount ? String(jazzCashAccount) : null,
                bankIban: bankIban ? String(bankIban) : null,
                pkrReserveUsd: Number(pkrReserveUsd || 0),
                collateralUsdc: Number(collateralUsdc || 0),
                maxSingleUsdc: Number(maxSingleUsdc || 500),
                dailyLimitUsdc: Number(dailyLimitUsdc || 2000),
            },
        });
        return (0, apiResponse_1.ok)(res, { provider }, 201);
    }
    catch (error) {
        if (error.code === 'P2002')
            return (0, apiResponse_1.fail)(res, 'Wallet address already registered', 409);
        next(error);
    }
};
exports.registerProvider = registerProvider;
const testWebhookDelivery = async (req, res, next) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return (0, apiResponse_1.fail)(res, 'Webhook test endpoint is disabled in production', 404);
        }
        const { eventName, targetUrl, payload } = req.body;
        if (!eventName || !targetUrl) {
            return (0, apiResponse_1.fail)(res, 'eventName and targetUrl are required', 400);
        }
        const businessId = req.user?.id || 'guest';
        await webhook_service_1.webhookService.dispatch(String(eventName), businessId, {
            test: true,
            targetUrl,
            payload: payload || {},
        });
        return (0, apiResponse_1.ok)(res, { queued: true, eventName, targetUrl });
    }
    catch (error) {
        next(error);
    }
};
exports.testWebhookDelivery = testWebhookDelivery;
const emiWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-sfpy-signature'];
        const rawBody = req.rawBody || JSON.stringify(req.body || {});
        const expected = process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY;
        if (!expected || !signature) {
            return (0, apiResponse_1.fail)(res, 'Invalid signature', 401);
        }
        const expectedHex = require('crypto').createHmac('sha256', String(expected)).update(String(rawBody)).digest('hex');
        if (signature !== expectedHex) {
            return (0, apiResponse_1.fail)(res, 'Invalid signature', 401);
        }
        const { intentId } = req.query;
        const { amount, destinationAccount, transactionId, bankName } = req.body;
        if (!intentId || !transactionId) {
            return (0, apiResponse_1.fail)(res, 'intentId and transactionId are required', 400);
        }
        const matched = await offramp_service_1.offrampService.processWebhookMatch(String(intentId), {
            amount: Number(amount || 0),
            destinationAccount: String(destinationAccount || ''),
            transactionId: String(transactionId),
            bankName: String(bankName || 'SafePay'),
            signature: String(signature),
            verifiedAt: new Date().toISOString(),
        });
        return (0, apiResponse_1.ok)(res, { matched: !!matched, intentId: String(intentId) });
    }
    catch (error) {
        next(error);
    }
};
exports.emiWebhook = emiWebhook;
const createSettlementReceipt = async (req, res, next) => {
    try {
        const { intentId } = req.body;
        if (!intentId)
            return (0, apiResponse_1.fail)(res, 'intentId is required', 400);
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: String(intentId) } });
        if (!intent)
            return (0, apiResponse_1.fail)(res, 'Offramp intent not found', 404);
        const receipt = {
            receiptVersion: '1.0',
            generatedAt: new Date().toISOString(),
            intentId: intent.id,
            amountUsdc: intent.amountUsdc,
            quotePkr: intent.quotePkr,
            destinationType: intent.destinationType,
            destinationRef: intent.destinationRef,
            customerWallet: intent.customerWallet,
            lpWallet: intent.lpWallet,
            status: intent.status,
            settledAt: intent.settledAt,
            metadata: intent.metadata || {},
        };
        await database_1.prisma.offrampIntent.update({
            where: { id: intent.id },
            data: { metadata: { ...(intent.metadata || {}), lastReceipt: receipt } },
        });
        return (0, apiResponse_1.ok)(res, { intentId: intent.id, receipt });
    }
    catch (error) {
        next(error);
    }
};
exports.createSettlementReceipt = createSettlementReceipt;
const streamLpIntents = async (req, res) => {
    const lpWallet = req.query.wallet;
    if (!lpWallet) {
        return res.status(400).json({ success: false, error: 'Wallet address required' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('data: {"type":"CONNECTED"}\n\n');
    const listener = (intent) => {
        if (intent && intent.lpWallet === lpWallet) {
            res.write(`data: ${JSON.stringify({ type: 'INTENT_UPDATED', intent })}\n\n`);
        }
    };
    offramp_service_1.offrampEvents.on('intent_updated', listener);
    req.on('close', () => {
        offramp_service_1.offrampEvents.off('intent_updated', listener);
    });
};
exports.streamLpIntents = streamLpIntents;
//# sourceMappingURL=offramp.controller.js.map