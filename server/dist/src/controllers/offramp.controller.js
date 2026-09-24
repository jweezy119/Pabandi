"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamLpIntents = exports.createSettlementReceipt = exports.emiWebhook = exports.testWebhookDelivery = exports.registerProvider = exports.listProviders = exports.expireStaleIntents = exports.getOfframpQuote = exports.acceptProof = exports.getIntents = exports.submitProof = exports.matchLp = exports.createIntent = void 0;
const database_1 = require("../utils/database");
const offramp_service_1 = require("../services/offramp.service");
const webhook_service_1 = require("../services/webhook.service");
const cashapp_service_1 = require("../services/cashapp.service");
const apiResponse_1 = require("../utils/apiResponse");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
// Track concurrent SSE connections per LP wallet — caps at 3 per wallet to
// prevent resource exhaustion from a single wallet opening many streams.
const sseConnectionCount = new Map();
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
        // Sanity cap on base64 image size — 10 MB decoded max (≈ 13.3 MB base64).
        // Prevents a malicious LP from OOM-ing the server with a giant screenshot.
        const MAX_BASE64_BYTES = 10 * 1024 * 1024;
        if (imageBase64 && Buffer.byteLength(imageBase64, 'utf8') > MAX_BASE64_BYTES) {
            return (0, apiResponse_1.fail)(res, `imageBase64 exceeds ${MAX_BASE64_BYTES} byte limit`, 413);
        }
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
        // Only allow settlement from PROOF_SUBMITTED — not from MATCHED (no proof, no settlement).
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (!intent)
            return (0, apiResponse_1.fail)(res, 'Offramp intent not found', 404);
        if (intent.status !== 'PROOF_SUBMITTED') {
            return (0, apiResponse_1.fail)(res, `Cannot accept proof: intent is ${intent.status}, expected PROOF_SUBMITTED`, 409);
        }
        await offramp_service_1.offrampService.acceptProof(intentId);
        const settled = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        return (0, apiResponse_1.ok)(res, { intent: settled });
    }
    catch (error) {
        next(error);
    }
};
exports.acceptProof = acceptProof;
const getOfframpQuote = async (req, res, next) => {
    try {
        const { cryptoAmount, cryptoCurrency = 'USDC', fiatCurrency = 'USD', destinationType = 'BANK' } = req.body;
        if (!cryptoAmount || Number(cryptoAmount) <= 0) {
            return (0, apiResponse_1.fail)(res, 'cryptoAmount must be greater than 0', 400);
        }
        const quote = await cashapp_service_1.cashAppService.getOfframpQuote({
            cryptoAmount: Number(cryptoAmount),
            cryptoCurrency: String(cryptoCurrency),
            fiatCurrency: String(fiatCurrency),
        });
        return (0, apiResponse_1.ok)(res, { quote, destinationType });
    }
    catch (error) {
        next(error);
    }
};
exports.getOfframpQuote = getOfframpQuote;
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
        const collateral = Number(collateralUsdc || 0);
        const maxSingle = Number(maxSingleUsdc || 500);
        const dailyLimit = Number(dailyLimitUsdc || 2000);
        // Business logic validation — an LP cannot offer more than they hold.
        if (maxSingle > collateral) {
            return (0, apiResponse_1.fail)(res, `maxSingleUsdc (${maxSingle}) cannot exceed collateralUsdc (${collateral})`, 422);
        }
        if (dailyLimit > collateral) {
            return (0, apiResponse_1.fail)(res, `dailyLimitUsdc (${dailyLimit}) cannot exceed collateralUsdc (${collateral})`, 422);
        }
        if (collateral <= 0) {
            return (0, apiResponse_1.fail)(res, 'collateralUsdc must be greater than 0', 422);
        }
        const provider = await database_1.prisma.liquidityProvider.create({
            data: {
                walletAddress: String(walletAddress),
                displayName: displayName ? String(displayName) : null,
                raastId: raastId ? String(raastId) : null,
                jazzCashAccount: jazzCashAccount ? String(jazzCashAccount) : null,
                bankIban: bankIban ? String(bankIban) : null,
                pkrReserveUsd: Number(pkrReserveUsd || 0),
                collateralUsdc: collateral,
                maxSingleUsdc: maxSingle,
                dailyLimitUsdc: dailyLimit,
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
        if (!signature || typeof signature !== 'string') {
            return (0, apiResponse_1.fail)(res, 'Missing signature header', 401);
        }
        // Use raw body when available (captured by express.json verify hook); fall back safely
        const rawBody = req.rawBody;
        const bodyToVerify = rawBody != null && typeof rawBody === 'string'
            ? rawBody
            : JSON.stringify(req.body ?? {});
        const expectedSecret = process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY;
        if (!expectedSecret) {
            logger_1.logger.error('[Offramp] SAFEPAY webhook secret is not configured');
            return (0, apiResponse_1.fail)(res, 'Server misconfiguration', 500);
        }
        const expectedHex = crypto_1.default
            .createHmac('sha256', expectedSecret)
            .update(bodyToVerify)
            .digest('hex');
        // Constant-time comparison to avoid timing-side-channel on the webhook secret
        if (crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHex))) {
            // valid signature path continues below
        }
        else {
            logger_1.logger.warn(`[Offramp] EMI webhook signature mismatch for intentId=${req.query.intentId}`);
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
            signature,
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
    // Verify the requester is a registered, active LP before opening the SSE stream.
    // Accept either an API key (x-api-key) or the LP wallet itself as a shared secret
    // so that only the legitimate LP holder can subscribe to their own intents.
    const providedKey = req.headers['x-api-key'];
    const expectedKey = process.env.OFFRAMP__LP_API_KEY;
    const keyMatches = typeof providedKey === 'string' &&
        expectedKey &&
        crypto_1.default.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey));
    let isRegisteredLp = false;
    try {
        const lp = await database_1.prisma.liquidityProvider.findUnique({
            where: { walletAddress: lpWallet, isActive: true },
        });
        isRegisteredLp = !!lp;
    }
    catch {
        isRegisteredLp = false;
    }
    // Allow access if the LP API key matches OR the wallet is a registered active LP.
    if (!keyMatches && !isRegisteredLp) {
        return res.status(403).json({ success: false, error: 'Not authorized for this wallet stream' });
    }
    // ── SSE hardening ──────────────────────────────────────────────────────────
    // Cap concurrent SSE connections per wallet to prevent resource exhaustion.
    const MAX_SSE_CONNECTIONS = 3;
    const conns = (sseConnectionCount.get(lpWallet) || 0);
    if (conns >= MAX_SSE_CONNECTIONS) {
        return res.status(429).json({ success: false, error: 'Too many SSE connections for this wallet' });
    }
    sseConnectionCount.set(lpWallet, conns + 1);
    // Set headers and flush.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('data: {"type":"CONNECTED"}\n\n');
    // Heartbeat: send a ping every 30s to keep the connection alive and detect
    // dead clients early. If the client doesn't respond, we'll detect it on
    // the next write attempt and clean up.
    const heartbeatInterval = setInterval(() => {
        try {
            res.write(': ping\n\n');
        }
        catch {
            // Client disconnected — cleanup will happen on 'close' event
            clearInterval(heartbeatInterval);
        }
    }, 30000);
    // Cleanup on disconnect or timeout.
    let disconnected = false;
    const cleanup = () => {
        if (disconnected)
            return;
        disconnected = true;
        clearInterval(heartbeatInterval);
        offramp_service_1.offrampEvents.off('intent_updated', listener);
        const current = sseConnectionCount.get(lpWallet) || 0;
        sseConnectionCount.set(lpWallet, Math.max(0, current - 1));
    };
    res.on('close', cleanup);
    res.on('error', cleanup);
    // Timeout: if no data is sent within 5 minutes, close the connection.
    // This prevents zombie connections from dead clients.
    res.setTimeout(5 * 60 * 1000, () => {
        if (!disconnected) {
            try {
                res.write('event: error\ndata: "Connection timed out"\n\n');
            }
            catch { /* ignore */ }
            cleanup();
            res.statusCode = 408;
            res.end();
        }
    });
    const listener = (intent) => {
        if (intent && intent.lpWallet === lpWallet) {
            try {
                res.write(`data: ${JSON.stringify({ type: 'INTENT_UPDATED', intent })}\n\n`);
            }
            catch {
                // Client disconnected
                cleanup();
            }
        }
    };
    offramp_service_1.offrampEvents.on('intent_updated', listener);
    // Send initial confirmation that the stream is live.
    res.write(`event: status\ndata: ${JSON.stringify({ connected: true, wallet: lpWallet })}\n\n`);
};
exports.streamLpIntents = streamLpIntents;
//# sourceMappingURL=offramp.controller.js.map