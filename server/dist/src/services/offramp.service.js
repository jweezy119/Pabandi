"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offrampService = exports.OfframpService = exports.offrampEvents = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const qwen_rail_1 = require("./rails/qwen.rail");
const mock_emi_rail_1 = require("./rails/mock-emi.rail");
const events_1 = require("events");
const webhook_service_1 = require("./webhook.service");
const channel_dispatcher_service_1 = require("./channel-dispatcher.service");
exports.offrampEvents = new events_1.EventEmitter();
class OfframpService {
    async requestIntent(customerWallet, amountUsdc, minRatePkr, destinationType, destinationRef, businessId, idempotencyKey) {
        if (idempotencyKey) {
            const recent = await database_1.prisma.offrampIntent.findUnique({
                where: { idempotencyKey },
            });
            if (recent && ['SETTLED', 'REFUNDED', 'DISPUTED', 'REJECTED'].includes(recent.status)) {
                return recent;
            }
            else if (recent) {
                return recent; // Already pending or matched
            }
        }
        if (!amountUsdc || amountUsdc <= 0) {
            throw new Error('Invalid amountUsdc: must be greater than 0');
        }
        const trimmedRef = String(destinationRef).trim();
        if (trimmedRef.length < 3 || trimmedRef.length > 64) {
            throw new Error('Invalid destinationRef: must be 3-64 characters');
        }
        const intent = await database_1.prisma.offrampIntent.create({
            data: {
                customerWallet,
                amountUsdc,
                minRatePkr,
                destinationType,
                destinationRef: trimmedRef,
                businessId,
                expiresAt: new Date(Date.now() + 1000 * 60 * 2), // We will update TTL logic later based on trust tiers
                quotePkr: +(amountUsdc * minRatePkr).toFixed(2),
                idempotencyKey,
            },
        });
        logger_1.logger.info(`[Offramp] Intent created ${intent.id} for ${customerWallet}`);
        if (businessId) {
            webhook_service_1.webhookService.dispatch('offramp.intent.created', businessId, {
                intentId: intent.id,
                amountUsdc: intent.amountUsdc,
                quotePkr: intent.quotePkr,
                destinationType: intent.destinationType,
                expiresAt: intent.expiresAt,
            });
        }
        exports.offrampEvents.emit('intent_updated', intent);
        // Broadcast to LPs via ChannelDispatcher
        await channel_dispatcher_service_1.channelDispatcher.dispatchNewIntent(intent);
        return intent;
    }
    async matchLp(intentId, lpWallet = '') {
        const now = new Date();
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (!intent)
            throw new Error('Intent not found');
        if (intent.expiresAt && intent.expiresAt < now) {
            throw new Error('Intent expired');
        }
        if (intent.status !== 'PENDING_LP') {
            throw new Error(`Intent already ${intent.status}`);
        }
        let targetLpWallet = lpWallet;
        // Auto-assignment if no LP wallet provided
        if (!targetLpWallet) {
            const availableLp = await database_1.prisma.liquidityProvider.findFirst({
                where: { isActive: true },
                orderBy: { trustScore: 'desc' }
            });
            if (!availableLp)
                throw new Error('No active LP found');
            targetLpWallet = availableLp.walletAddress;
        }
        const lp = await database_1.prisma.liquidityProvider.findUnique({
            where: { walletAddress: targetLpWallet },
        });
        if (!lp || !lp.isActive) {
            throw new Error('Liquidity provider not found or inactive');
        }
        if (intent.amountUsdc > lp.maxSingleUsdc) {
            throw new Error(`Amount exceeds LP max single payout of ${lp.maxSingleUsdc} USDC`);
        }
        const updated = await database_1.prisma.$transaction(async (tx) => {
            const availableUsdc = lp.collateralUsdc - lp.lockedCollateralUsdc;
            if (availableUsdc < intent.amountUsdc) {
                throw new Error('Insufficient available collateral');
            }
            const { count } = await tx.offrampIntent.updateMany({
                where: { id: intentId, status: 'PENDING_LP' },
                data: {
                    status: 'MATCHED',
                    lpWallet: targetLpWallet,
                    matchedAt: new Date(),
                },
            });
            if (count === 0)
                throw new Error('Intent already matched, expired, or not found');
            await tx.liquidityProvider.update({
                where: { walletAddress: targetLpWallet },
                data: { lockedCollateralUsdc: { increment: intent.amountUsdc } }
            });
            await tx.vaultLedger.create({
                data: {
                    lpId: lp.id,
                    intentId: intent.id,
                    action: 'LOCK',
                    amount: intent.amountUsdc,
                    balanceAfter: availableUsdc - intent.amountUsdc,
                    reason: 'Matched Intent'
                }
            });
            return await tx.offrampIntent.findUniqueOrThrow({ where: { id: intentId } });
        });
        logger_1.logger.info(`[Offramp] Intent ${intentId} matched with LP ${targetLpWallet}`);
        if (intent.businessId) {
            webhook_service_1.webhookService.dispatch('offramp.intent.matched', intent.businessId, {
                intentId: updated.id,
                lpWallet: targetLpWallet,
                matchedAt: updated.matchedAt,
                amountUsdc: updated.amountUsdc,
            });
        }
        exports.offrampEvents.emit('intent_updated', updated);
        return updated;
    }
    async submitProof(intentId, lpWallet, imageBase64) {
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (!intent)
            throw new Error('Intent not found');
        if (intent.lpWallet !== lpWallet)
            throw new Error('Forbidden');
        const expectedPkr = intent.amountUsdc * intent.minRatePkr;
        const proof = await database_1.prisma.offrampProof.create({
            data: {
                intentId,
                lpWallet,
                imageBase64,
                status: 'PENDING',
                confidence: 0,
                verifyResult: {}
            },
        });
        try {
            const verification = await qwen_rail_1.qwenScreenshotRail.verifyPayment({
                intentId: intent.id,
                screenshotBase64: imageBase64,
                expectedAmountPkr: expectedPkr,
                expectedDestination: intent.destinationRef
            });
            await database_1.prisma.offrampProof.update({
                where: { id: proof.id },
                data: {
                    verifyResult: verification.fields,
                    plainTextExtract: verification.rawJson,
                    confidence: verification.confidence,
                    status: verification.isValid ? 'ACCEPTED' : 'REJECTED',
                    verifiedAt: new Date()
                }
            });
            if (verification.isValid) {
                await this.acceptProof(intent.id);
            }
            else {
                const disputedIntent = await database_1.prisma.offrampIntent.update({
                    where: { id: intent.id },
                    data: { status: 'DISPUTED' }
                });
                exports.offrampEvents.emit('intent_updated', disputedIntent);
                logger_1.logger.warn(`[Offramp] Proof rejected by AI for intent ${intentId}. Moving to DISPUTED.`);
            }
            return verification;
        }
        catch (error) {
            logger_1.logger.error(`[Offramp] AI Verification threw error for ${intentId}: ${error.message}`);
            const disputedIntent = await database_1.prisma.offrampIntent.update({
                where: { id: intent.id },
                data: { status: 'DISPUTED' }
            });
            exports.offrampEvents.emit('intent_updated', disputedIntent);
            throw error;
        }
    }
    async acceptProof(intentId) {
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (!intent)
            throw new Error('Intent not found');
        const feeAmount = intent.amountUsdc * (intent.feePct / 100);
        const netToLp = intent.amountUsdc - feeAmount;
        await database_1.prisma.$transaction(async (tx) => {
            const updated = await tx.offrampIntent.updateMany({
                where: { id: intentId, status: { in: ['PROOF_SUBMITTED', 'MATCHED'] } },
                data: {
                    status: 'SETTLED',
                    settledAt: new Date()
                }
            });
            if (updated.count === 0) {
                throw new Error(`Race condition: Intent ${intentId} cannot be settled.`);
            }
            await tx.liquidityProvider.update({
                where: { walletAddress: intent.lpWallet },
                data: {
                    lockedCollateralUsdc: { decrement: intent.amountUsdc },
                    collateralUsdc: { increment: netToLp }
                }
            });
            const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet } });
            await tx.vaultLedger.create({
                data: {
                    lpId: lp.id,
                    intentId: intent.id,
                    action: 'RELEASE',
                    amount: intent.amountUsdc,
                    balanceAfter: lp.collateralUsdc - lp.lockedCollateralUsdc,
                    reason: 'Intent Settled'
                }
            });
            await tx.vaultLedger.create({
                data: {
                    lpId: lp.id,
                    intentId: intent.id,
                    action: 'CREDIT',
                    amount: netToLp,
                    balanceAfter: lp.collateralUsdc - lp.lockedCollateralUsdc,
                    reason: 'Yield and Principal payout'
                }
            });
        });
        logger_1.logger.info(`[Offramp] Intent ${intentId} SETTLED.`);
        const settledIntent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (settledIntent?.businessId) {
            webhook_service_1.webhookService.dispatch('offramp.intent.settled', settledIntent.businessId, {
                intentId: settledIntent.id
            });
        }
        exports.offrampEvents.emit('intent_updated', settledIntent);
        return settledIntent;
    }
    async expireStaleIntents() {
        const staleIntents = await database_1.prisma.offrampIntent.findMany({
            where: {
                status: { in: ['PENDING_LP', 'MATCHED'] },
                expiresAt: { lte: new Date() }
            }
        });
        let count = 0;
        for (const intent of staleIntents) {
            const result = await database_1.prisma.offrampIntent.updateMany({
                where: { id: intent.id, status: { in: ['PENDING_LP', 'MATCHED'] } },
                data: { status: 'REFUNDED' }
            });
            if (result.count > 0) {
                logger_1.logger.warn(`[Offramp] SLA breach (180s expired) on intent ${intent.id}. Refunding customer.`);
                count++;
                if (intent.lpWallet) {
                    // If it was matched, they held up the user. We must unlock their collateral.
                    await database_1.prisma.$transaction(async (tx) => {
                        const lp = await tx.liquidityProvider.findUnique({ where: { walletAddress: intent.lpWallet } });
                        if (lp) {
                            await tx.liquidityProvider.update({
                                where: { id: lp.id },
                                data: { lockedCollateralUsdc: { decrement: intent.amountUsdc } }
                            });
                            await tx.vaultLedger.create({
                                data: {
                                    lpId: lp.id,
                                    intentId: intent.id,
                                    action: 'RELEASE',
                                    amount: intent.amountUsdc,
                                    balanceAfter: (lp.collateralUsdc - lp.lockedCollateralUsdc) + intent.amountUsdc,
                                    reason: 'Intent Expired (Strike)'
                                }
                            });
                            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                            const strikes = await tx.vaultLedger.count({
                                where: {
                                    lpId: lp.id,
                                    reason: 'Intent Expired (Strike)',
                                    createdAt: { gte: oneDayAgo }
                                }
                            });
                            if (strikes >= 3) {
                                await tx.lpChannel.updateMany({
                                    where: { lpId: lp.id },
                                    data: { quietHours: 'PAUSED' }
                                });
                                await tx.liquidityProvider.update({
                                    where: { id: lp.id },
                                    data: { trustScore: { decrement: 5 } }
                                });
                                logger_1.logger.warn(`[Offramp] LP ${lp.walletAddress} hit 3 strikes in 24h. Trust decayed and channels paused.`);
                            }
                        }
                    });
                }
                const refundedIntent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intent.id } });
                if (refundedIntent)
                    exports.offrampEvents.emit('intent_updated', refundedIntent);
            }
        }
        return count;
    }
    async processWebhookMatch(intentId, webhookPayload) {
        const intent = await database_1.prisma.offrampIntent.findUnique({ where: { id: intentId } });
        if (!intent || intent.status !== 'MATCHED') {
            logger_1.logger.warn(`[Offramp] Webhook processed for intent ${intentId} but it is not MATCHED.`);
            return false;
        }
        const expectedPkr = intent.amountUsdc * intent.minRatePkr;
        try {
            const verification = await mock_emi_rail_1.mockEmiRail.verifyPayment({
                intentId: intent.id,
                expectedAmountPkr: expectedPkr,
                expectedDestination: intent.destinationRef,
                webhookData: webhookPayload
            });
            if (verification.isValid) {
                const submitResult = await database_1.prisma.offrampIntent.updateMany({
                    where: { id: intentId, status: 'MATCHED' },
                    data: { status: 'PROOF_SUBMITTED' }
                });
                if (submitResult.count > 0) {
                    await database_1.prisma.offrampProof.create({
                        data: {
                            intentId,
                            lpWallet: intent.lpWallet,
                            imageBase64: 'webhook_verified',
                            verifyResult: verification.fields,
                            plainTextExtract: verification.providerTxnRef,
                            confidence: verification.confidence,
                            status: 'ACCEPTED',
                            verifiedAt: new Date()
                        }
                    });
                    await this.acceptProof(intent.id);
                    return true;
                }
            }
            else {
                logger_1.logger.warn(`[Offramp] Webhook payload did not match intent ${intentId}.`);
            }
        }
        catch (error) {
            logger_1.logger.error(`[Offramp] Webhook Verification threw error for ${intentId}: ${error.message}`);
        }
        return false;
    }
}
exports.OfframpService = OfframpService;
exports.offrampService = new OfframpService();
//# sourceMappingURL=offramp.service.js.map