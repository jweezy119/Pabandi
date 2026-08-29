"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.channexWebhook = exports.getUsage = exports.reportTransactionOutcome = exports.getPartnerTrustBadge = exports.getReliabilityScore = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const noShowPredictor_1 = require("../services/ai/noShowPredictor");
const trustScore_service_1 = require("../services/trustScore.service");
const apiResponse_1 = require("../utils/apiResponse");
const crypto_1 = __importDefault(require("crypto"));
// ─── Score Endpoint ────────────────────────────────────────────────────────────
const getReliabilityScore = async (req, res, next) => {
    try {
        const { externalUserId, email, phone, customerHistory, timeFactors, bookingFactors, businessFactors, serviceFactors, eventFactors, } = req.body;
        if (!externalUserId) {
            return (0, apiResponse_1.fail)(res, 'externalUserId is required', 400);
        }
        // Optionally cross-reference a Pabandi user for enriched scoring
        let pabandiReliabilityScore = null;
        if (email || phone) {
            const whereClause = email ? { email } : { phone };
            const pabandiUser = await database_1.prisma.user.findFirst({
                where: whereClause,
                select: { reliabilityScore: true },
            });
            pabandiReliabilityScore = pabandiUser?.reliabilityScore ?? null;
        }
        // Build feature set for the predictor
        const features = {
            customerHistory,
            timeFactors,
            bookingFactors,
            businessFactors,
            serviceFactors,
            eventFactors,
        };
        // Run prediction
        const prediction = await noShowPredictor_1.noShowPredictor.predict(features);
        // Blend Pabandi's own reliabilityScore if available (0-100 scale)
        // A higher reliabilityScore lowers the final riskScore
        let finalRiskScore = prediction.riskScore;
        if (pabandiReliabilityScore !== null) {
            // Each point of Pabandi score above 50 reduces risk by 0.3 pts
            const bonus = Math.max(0, pabandiReliabilityScore - 50) * 0.3;
            finalRiskScore = Math.max(0, Math.round(prediction.riskScore - bonus));
        }
        const requestId = `req_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const client = req.apiClient;
        const quotaRemaining = Math.max(0, client.callsLimit - client.callsUsed - 1);
        logger_1.logger.info(`[External API] Score for externalUserId=${externalUserId} riskScore=${finalRiskScore} client=${client.name}`);
        return (0, apiResponse_1.ok)(res, {
            requestId,
            externalUserId,
            pabandiEnriched: pabandiReliabilityScore !== null,
            reliabilityScore: pabandiReliabilityScore ?? Math.round((1 - prediction.probability) * 100),
            riskScore: finalRiskScore,
            riskLevel: prediction.riskLevel,
            probability: prediction.probability,
            factors: prediction.factors,
            depositRecommendation: prediction.depositRecommendation,
            overbookingAdvice: prediction.overbookingAdvice ?? null,
            meta: {
                tier: client.tier,
                quotaUsed: client.callsUsed + 1,
                quotaLimit: client.callsLimit,
                quotaRemaining,
                scoredAt: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[External API] getReliabilityScore error:', error);
        next(error);
    }
};
exports.getReliabilityScore = getReliabilityScore;
// ─── Partner Trust Badge (B2B API) ───────────────────────────────────────────────
const getPartnerTrustBadge = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                trustScore: true,
                verificationTier: true,
                socialIdentities: true
            },
        });
        if (!user) {
            return (0, apiResponse_1.fail)(res, 'User not found', 404);
        }
        const latestAudit = await database_1.prisma.trustAuditTrail.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { currentHash: true, previousHash: true }
        });
        return (0, apiResponse_1.ok)(res, {
            userId,
            score: user.trustScore,
            tier: user.verificationTier,
            osintSignals: 10 + user.socialIdentities.length,
            hashes: latestAudit ? [latestAudit.currentHash, latestAudit.previousHash || '0x000000000000'] : ['0x000000000000'],
            meta: {
                clientName: req.apiClient.name,
                tier: req.apiClient.tier,
                scoredAt: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[External API] getPartnerTrustBadge error:', error);
        next(error);
    }
};
exports.getPartnerTrustBadge = getPartnerTrustBadge;
// ─── Report Transaction Outcome ───────────────────────────────────────────────
const reportTransactionOutcome = async (req, res, next) => {
    try {
        const { userId, status, transactionId } = req.body;
        if (!userId || !status) {
            return (0, apiResponse_1.fail)(res, 'userId and status are required', 400);
        }
        let severity = 'neutral';
        if (status === 'COMPLETED' || status === 'SUCCESS')
            severity = 'positive';
        else if (status === 'NO_SHOW' || status === 'FRAUD')
            severity = 'negative';
        await trustScore_service_1.trustScoreService.processEvent(userId, {
            component: 'EXTERNAL_B2B',
            reason: `Partner ${req.apiClient?.name} reported ${status} for transaction ${transactionId || 'unknown'}`,
            severity
        });
        return (0, apiResponse_1.ok)(res, { message: `Transaction outcome '${status}' logged to Trust Physics Engine. Score calibration queued.` });
    }
    catch (error) {
        logger_1.logger.error('[External API] reportTransactionOutcome error:', error);
        next(error);
    }
};
exports.reportTransactionOutcome = reportTransactionOutcome;
// ─── Quota Usage ───────────────────────────────────────────────────────────────
const getUsage = async (req, res, next) => {
    try {
        const client = req.apiClient;
        // Fetch last 30 days of usage stats
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const dailyUsage = await database_1.prisma.apiUsageLog.groupBy({
            by: ['createdAt'],
            where: {
                clientId: client.id,
                createdAt: { gte: since },
            },
            _count: { id: true },
            orderBy: { createdAt: 'asc' },
        });
        return (0, apiResponse_1.ok)(res, {
            client: {
                name: client.name,
                tier: client.tier,
            },
            quota: {
                used: client.callsUsed,
                limit: client.callsLimit,
                remaining: Math.max(0, client.callsLimit - client.callsUsed),
                percentUsed: Math.round((client.callsUsed / client.callsLimit) * 100),
            },
            recentActivity: dailyUsage.map((d) => ({
                date: d.createdAt,
                calls: d._count.id,
            })),
        });
    }
    catch (error) {
        logger_1.logger.error('[External API] getUsage error:', error);
        next(error);
    }
};
exports.getUsage = getUsage;
// ─── Channex Webhook ─────────────────────────────────────────────────────────
const channexWebhook = async (req, res) => {
    try {
        const payload = req.body;
        // We only care about new bookings from Airbnb/Channex to block Pabandi
        if (payload.event === 'booking.created') {
            const channexBooking = payload.data;
            const propertyId = channexBooking.property_id;
            const business = await database_1.prisma.business.findUnique({
                where: { channexPropertyId: propertyId }
            });
            if (business) {
                logger_1.logger.info(`Incoming Airbnb booking for business ${business.id}, blocking Pabandi calendar...`);
                // Find or create a user for this external booking
                const guestEmail = channexBooking.customer?.mail || `guest_${channexBooking.id}@channex.pabandi.com`;
                let user = await database_1.prisma.user.findUnique({ where: { email: guestEmail } });
                if (!user) {
                    user = await database_1.prisma.user.create({
                        data: {
                            email: guestEmail,
                            firstName: channexBooking.customer?.name || 'Airbnb',
                            lastName: channexBooking.customer?.surname || 'Guest',
                            phone: channexBooking.customer?.phone || null,
                            passwordHash: 'dummy_hash_for_external_guest',
                        }
                    });
                }
                // Block dates on Pabandi
                await database_1.prisma.reservation.create({
                    data: {
                        businessId: business.id,
                        customerId: user.id,
                        reservationDate: new Date(channexBooking.arrival_date),
                        checkOutDate: new Date(channexBooking.departure_date),
                        reservationTime: '15:00', // Default check-in time placeholder
                        numberOfGuests: channexBooking.occupancy?.adults || 2,
                        customerName: `${channexBooking.customer?.name} ${channexBooking.customer?.surname} (via Airbnb)`,
                        customerPhone: '0000000000',
                        status: 'CONFIRMED',
                        depositStatus: 'NOT_REQUIRED',
                        channexBookingId: channexBooking.id,
                    }
                });
            }
        }
        return (0, apiResponse_1.ok)(res, { received: true });
    }
    catch (error) {
        logger_1.logger.error('[Channex Webhook] Error:', error);
        // Always return 200 to webhooks to prevent retries unless it's a critical error
        return res.status(200).send('Webhook received with errors');
    }
};
exports.channexWebhook = channexWebhook;
//# sourceMappingURL=external.controller.js.map