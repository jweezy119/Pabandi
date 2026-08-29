"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDemoCheckoutSession = exports.getCheckoutReceipt = exports.initiateEscrowCheckout = exports.initiateCryptoCheckout = exports.initiateStripeCheckout = exports.createPartnerEmbedCheckoutSession = exports.createEmbedCheckoutSession = exports.completeCheckoutSession = exports.getCheckoutSession = exports.createCheckoutSession = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const stripe_service_1 = require("../services/stripe.service");
const safepay_service_1 = require("../services/safepay.service");
const escrow_service_1 = require("../services/escrow.service");
const apiResponse_1 = require("../utils/apiResponse");
const createCheckoutSession = async (req, res) => {
    try {
        const { businessId, amount, currency, escrowTerms, successUrl, cancelUrl, metadata } = req.body;
        if (!businessId || !amount || !successUrl || !cancelUrl) {
            return (0, apiResponse_1.fail)(res, 'Missing required fields for checkout session', 400);
        }
        const business = await database_1.prisma.business.findUnique({
            where: { id: businessId }
        });
        if (!business) {
            return (0, apiResponse_1.fail)(res, 'Business not found', 404);
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                businessId,
                amount: parseFloat(amount),
                currency: currency || 'USD',
                escrowTerms: escrowTerms || {},
                successUrl,
                cancelUrl,
                metadata: metadata || {},
                expiresAt,
                status: 'PENDING'
            }
        });
        const host = process.env.FRONTEND_URL || 'http://localhost:3000';
        const checkoutUrl = `${host}/checkout/${session.id}`;
        let gateway = 'UNIVERSAL';
        let providerUrl;
        if (business.currency === 'PKR') {
            try {
                const checkoutReference = `cs_${session.id}`;
                providerUrl = await safepay_service_1.safepayService.createCheckoutUrl(amount, checkoutReference);
                gateway = 'safepay';
                await database_1.prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
                });
            }
            catch {
                providerUrl = checkoutUrl;
            }
        }
        if (providerUrl && providerUrl !== checkoutUrl) {
            await database_1.prisma.checkoutSession.update({
                where: { id: session.id },
                data: { metadata: { ...(metadata || {}), gateway, providerUrl } },
            });
        }
        return (0, apiResponse_1.ok)(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error creating checkout session:', error);
        return (0, apiResponse_1.fail)(res, 'Failed to create checkout session', 500);
    }
};
exports.createCheckoutSession = createCheckoutSession;
const getCheckoutSession = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id },
            include: {
                business: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        trustScore: true,
                        isVerified: true
                    }
                }
            }
        });
        if (!session) {
            return (0, apiResponse_1.fail)(res, 'Checkout session not found', 404);
        }
        if (new Date() > new Date(session.expiresAt) && session.status === 'PENDING') {
            await database_1.prisma.checkoutSession.update({
                where: { id },
                data: { status: 'EXPIRED' }
            });
            session.status = 'EXPIRED';
        }
        const metadata = session.metadata || {};
        const responsePayload = session;
        if (metadata.gateway)
            responsePayload.gateway = metadata.gateway;
        if (metadata.providerUrl)
            responsePayload.providerUrl = metadata.providerUrl;
        return (0, apiResponse_1.ok)(res, responsePayload);
    }
    catch (error) {
        logger_1.logger.error('Error fetching checkout session:', error);
        return (0, apiResponse_1.fail)(res, 'Failed to fetch checkout session', 500);
    }
};
exports.getCheckoutSession = getCheckoutSession;
const completeCheckoutSession = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id }
        });
        if (!session) {
            return (0, apiResponse_1.fail)(res, 'Checkout session not found', 404);
        }
        if (session.status !== 'PENDING') {
            return (0, apiResponse_1.fail)(res, `Session is already ${session.status}`, 400);
        }
        const updatedSession = await database_1.prisma.checkoutSession.update({
            where: { id },
            data: { status: 'PAID' }
        });
        if (updatedSession.metadata?.source === 'ai_receptionist') {
            try {
                const { openwaTemplateService } = await Promise.resolve().then(() => __importStar(require('../services/openwa.template.service')));
                const customerPhone = updatedSession.metadata?.customerPhone || '+123****7890';
                await openwaTemplateService.sendTemplate(customerPhone, 'deposit_receipt', {
                    customerName: 'Guest',
                    businessName: 'Pabandi Property',
                    amount: `${updatedSession.amount} ${updatedSession.currency}`,
                    reservationDate: 'Confirmed Date',
                    reservationTime: 'Confirmed Time'
                });
            }
            catch (err) {
                logger_1.logger.error('Failed to send WhatsApp deposit receipt:', err);
            }
        }
        if (updatedSession.metadata?.source === 'drop_bot_buy') {
            try {
                const pabReward = Math.floor(updatedSession.amount * 0.1);
                logger_1.logger.info(`[Drop Engine] Issued ${pabReward} $PAB reward to buyer for drop purchase (Session ${updatedSession.id})`);
                await database_1.prisma.checkoutSession.update({
                    where: { id },
                    data: {
                        metadata: {
                            ...updatedSession.metadata,
                            pabReward,
                            rewardStatus: 'ISSUED'
                        }
                    }
                });
            }
            catch (err) {
                logger_1.logger.error('Failed to issue $PAB reward:', err);
            }
        }
        try {
            const { yieldService } = await Promise.resolve().then(() => __importStar(require('../services/yield.service')));
            const tier = updatedSession.amount > 1000 ? 'INSTITUTIONAL' : 'RETAIL';
            const stakingPos = await yieldService.orchestrateStaking(updatedSession.amount, updatedSession.currency, tier);
            await database_1.prisma.checkoutSession.update({
                where: { id },
                data: {
                    metadata: {
                        ...updatedSession.metadata,
                        yieldPositionId: stakingPos.id,
                        yieldStatus: stakingPos.status
                    }
                }
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to orchestrate staking yield:', err);
        }
        const redirectUrl = new URL(updatedSession.successUrl);
        redirectUrl.searchParams.append('session_id', updatedSession.id);
        redirectUrl.searchParams.append('status', 'success');
        return (0, apiResponse_1.ok)(res, { redirectUrl: redirectUrl.toString() });
    }
    catch (error) {
        logger_1.logger.error('Error completing checkout session:', error);
        return (0, apiResponse_1.fail)(res, 'Failed to complete checkout session', 500);
    }
};
exports.completeCheckoutSession = completeCheckoutSession;
const createEmbedCheckoutSession = async (req, res) => {
    try {
        const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;
        if (!businessId || !amount || !successUrl || !cancelUrl) {
            return (0, apiResponse_1.fail)(res, 'Missing required fields for embed checkout session', 400);
        }
        const business = await database_1.prisma.business.findUnique({ where: { id: businessId } });
        if (!business) {
            return (0, apiResponse_1.fail)(res, 'Business not found', 404);
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                businessId,
                amount: parseFloat(amount),
                currency: currency || business.currency || 'USD',
                source: source || 'UNIVERSAL',
                escrowTerms: escrowTerms || null,
                metadata: metadata || null,
                successUrl,
                cancelUrl,
                expiresAt,
                status: 'PENDING',
            },
        });
        const host = process.env.FRONTEND_URL || 'http://localhost:3000';
        const checkoutUrl = `${host}/checkout/${session.id}`;
        let gateway = 'UNIVERSAL';
        let providerUrl;
        if (business.currency === 'PKR') {
            try {
                const checkoutReference = `cs_${session.id}`;
                providerUrl = await safepay_service_1.safepayService.createCheckoutUrl(amount, checkoutReference);
                gateway = 'safepay';
                await database_1.prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
                });
            }
            catch {
                providerUrl = checkoutUrl;
            }
        }
        if (providerUrl && providerUrl !== checkoutUrl) {
            await database_1.prisma.checkoutSession.update({
                where: { id: session.id },
                data: {
                    metadata: { ...(metadata || {}), gateway, providerUrl },
                },
            });
        }
        return (0, apiResponse_1.ok)(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error creating embed checkout session:', error);
        return (0, apiResponse_1.fail)(res, 'Failed to create embed checkout session', 500);
    }
};
exports.createEmbedCheckoutSession = createEmbedCheckoutSession;
const createPartnerEmbedCheckoutSession = async (req, res) => {
    try {
        const apiClient = req.apiClient;
        const partnerBusinessId = apiClient?.businessId;
        const { businessId, amount, currency, successUrl, cancelUrl, escrowTerms, metadata, source } = req.body;
        if (!partnerBusinessId || !businessId) {
            return (0, apiResponse_1.fail)(res, 'Missing businessId or partner API key business context', 400);
        }
        if (!amount || !successUrl || !cancelUrl) {
            return (0, apiResponse_1.fail)(res, 'Missing required fields for embed checkout session', 400);
        }
        const targetBusinessId = businessId || partnerBusinessId;
        const business = await database_1.prisma.business.findUnique({ where: { id: targetBusinessId } });
        if (!business) {
            return (0, apiResponse_1.fail)(res, 'Business not found', 404);
        }
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                businessId: targetBusinessId,
                amount: parseFloat(amount),
                currency: currency || business.currency || 'USD',
                source: source || 'UNIVERSAL',
                escrowTerms: escrowTerms || null,
                metadata: metadata || null,
                successUrl,
                cancelUrl,
                expiresAt,
                status: 'PENDING',
            },
        });
        const host = process.env.FRONTEND_URL || 'http://localhost:3000';
        const checkoutUrl = `${host}/checkout/${session.id}`;
        let gateway = 'UNIVERSAL';
        let providerUrl;
        if (business.currency === 'PKR') {
            try {
                const checkoutReference = `cs_${session.id}`;
                providerUrl = await safepay_service_1.safepayService.createCheckoutUrl(amount, checkoutReference);
                gateway = 'safepay';
                await database_1.prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { metadata: { ...(metadata || {}), gateway, providerUrl, safepayReference: checkoutReference } },
                });
            }
            catch {
                providerUrl = checkoutUrl;
            }
        }
        if (providerUrl && providerUrl !== checkoutUrl) {
            await database_1.prisma.checkoutSession.update({
                where: { id: session.id },
                data: {
                    metadata: { ...(metadata || {}), gateway, providerUrl },
                },
            });
        }
        return (0, apiResponse_1.ok)(res, { sessionId: session.id, checkoutUrl: providerUrl || checkoutUrl, gateway }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error creating partner embed checkout session:', error);
        return (0, apiResponse_1.fail)(res, 'Failed to create partner embed checkout session', 500);
    }
};
exports.createPartnerEmbedCheckoutSession = createPartnerEmbedCheckoutSession;
const initiateStripeCheckout = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id },
            include: { business: true }
        });
        if (!session || session.status !== 'PENDING') {
            return (0, apiResponse_1.fail)(res, 'Valid checkout session not found', 404);
        }
        const amountCents = Math.round(session.amount * 100);
        const stripeUrl = await stripe_service_1.stripeService.createCheckoutUrl(amountCents, session.currency, session.id, session.successUrl, session.cancelUrl, session.business.stripeAccountId || undefined);
        return (0, apiResponse_1.ok)(res, { url: stripeUrl });
    }
    catch (error) {
        logger_1.logger.error('Error initiating Stripe checkout', error);
        return (0, apiResponse_1.fail)(res, 'Internal server error', 500);
    }
};
exports.initiateStripeCheckout = initiateStripeCheckout;
const initiateCryptoCheckout = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!session || session.status !== 'PENDING') {
            return (0, apiResponse_1.fail)(res, 'Valid checkout session not found', 404);
        }
        const mint = process.env.USDC_MINT_DEVNET || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtCJr';
        const treasury = process.env.TAP_TREASURY ||
            process.env.NEXT_PUBLIC_PLATFORM_WALLET ||
            process.env.PLATFORM_WALLET_ADDRESS ||
            '';
        // persist crypto gateway so frontend shows the USDC button
        await database_1.prisma.checkoutSession.update({
            where: { id: session.id },
            data: { metadata: { ...(session.metadata || {}), gateway: 'crypto' } },
        });
        return (0, apiResponse_1.ok)(res, {
            url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`,
            gateway: 'crypto',
            currency: session.currency || 'USD',
            amount: session.amount,
            mint,
            treasury,
            reservationId: session.id,
            businessId: session.businessId,
        }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error initiating crypto checkout', error);
        return (0, apiResponse_1.fail)(res, 'Internal server error', 500);
    }
};
exports.initiateCryptoCheckout = initiateCryptoCheckout;
const initiateEscrowCheckout = async (req, res) => {
    try {
        const { id } = req.params;
        const { buyerEmail, sellerEmail } = req.body;
        if (!process.env.ESCROW_API_EMAIL || !process.env.ESCROW_API_KEY) {
            return (0, apiResponse_1.fail)(res, 'Escrow.com checkout is unavailable right now.', 503);
        }
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!session || session.status !== 'PENDING') {
            return (0, apiResponse_1.fail)(res, 'Valid checkout session not found', 404);
        }
        const description = session.escrowTerms
            ? `Escrow session ${id}`
            : `Pabandi escrow session ${id}`;
        const title = `Reservation ${id}`;
        const result = await escrow_service_1.escrowService.createTransaction({
            amount: session.amount,
            currency: session.currency,
            buyerEmail: buyerEmail || session.successUrl.replace(/.*\/\//, '').split('/')[0] || 'buyer@pabandi.com',
            sellerEmail: sellerEmail || 'seller@pabandi.com',
            description,
            itemTitle: title,
            reference: id,
        });
        await database_1.prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
                metadata: {
                    ...(session.metadata || {}),
                    gateway: 'escrow',
                    escrowTransactionId: result.id,
                    providerUrl: result.url,
                },
            },
        });
        return (0, apiResponse_1.ok)(res, {
            url: result.url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${id}`,
            gateway: 'escrow',
            currency: session.currency || 'USD',
            amount: session.amount,
            reservationId: id,
            businessId: session.businessId,
            transactionId: result.id,
        }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error initiating escrow checkout', error);
        return (0, apiResponse_1.fail)(res, 'Internal server error', 500);
    }
};
exports.initiateEscrowCheckout = initiateEscrowCheckout;
const getCheckoutReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await database_1.prisma.checkoutSession.findUnique({
            where: { id },
            include: { business: true },
        });
        if (!session) {
            return (0, apiResponse_1.fail)(res, 'Checkout session not found', 404);
        }
        const events = await database_1.prisma.escrowEvent.findMany({
            where: { checkoutSessionId: id },
            orderBy: { createdAt: 'asc' },
        });
        const latestEvent = events[events.length - 1] || null;
        const metadata = session.metadata || {};
        const transactionId = metadata.escrowTransactionId || metadata.transactionId || null;
        const statusLabel = session.status === 'PAID'
            ? 'Payment confirmed'
            : session.status === 'FUNDED'
                ? 'Funds secured in escrow'
                : session.status === 'RELEASED'
                    ? 'Funds released to seller'
                    : session.status === 'CANCELLED'
                        ? 'Transaction cancelled'
                        : session.status === 'DISPUTED'
                            ? 'Dispute opened'
                            : session.status === 'EXPIRED'
                                ? 'Session expired'
                                : 'Awaiting payment';
        const receipt = {
            sessionId: session.id,
            businessName: session.business?.name || 'Pabandi',
            amount: session.amount,
            currency: session.currency,
            status: session.status,
            statusLabel,
            gateway: metadata.gateway || 'UNIVERSAL',
            providerUrl: metadata.providerUrl || null,
            transactionId,
            webhookUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${id}`,
            eventCount: events.length,
            lastEvent: latestEvent,
            events,
            updatedAt: session.updatedAt,
        };
        return (0, apiResponse_1.ok)(res, { receipt });
    }
    catch (error) {
        logger_1.logger.error('Error fetching checkout receipt', error);
        return (0, apiResponse_1.fail)(res, 'Failed to fetch receipt', 500);
    }
};
exports.getCheckoutReceipt = getCheckoutReceipt;
const createDemoCheckoutSession = async (_req, res) => {
    try {
        const demoBusinessId = 'cms28eons000k2358v5n5y9o9';
        const amount = 5000;
        const currency = 'USD';
        const escrowConfigured = Boolean(process.env.ESCROW_API_EMAIL && process.env.ESCROW_API_KEY);
        const gateway = escrowConfigured ? 'escrow' : 'stripe';
        const session = await database_1.prisma.checkoutSession.create({
            data: {
                businessId: demoBusinessId,
                amount,
                currency,
                source: 'UNIVERSAL',
                successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/demo`,
                cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/demo`,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                metadata: {
                    source: 'demo',
                    gateway,
                    ...(gateway === 'escrow' ? { rails: ['escrow'] } : {}),
                },
            },
        });
        return (0, apiResponse_1.ok)(res, {
            sessionId: session.id,
            checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${session.id}`,
            gateway,
            currency,
            amount,
        }, 201);
    }
    catch (error) {
        logger_1.logger.error('Error creating demo checkout session', error);
        return (0, apiResponse_1.fail)(res, 'Internal server error', 500);
    }
};
exports.createDemoCheckoutSession = createDemoCheckoutSession;
//# sourceMappingURL=checkout.controller.js.map