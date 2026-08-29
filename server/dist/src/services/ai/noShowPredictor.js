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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.noShowPredictor = exports.NoShowPredictor = void 0;
const tf = __importStar(require("@tensorflow/tfjs"));
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const axios_1 = __importDefault(require("axios"));
// ── Emerging Market Deposit Constants ──────────────────────────
const DEPOSIT_CONFIG = {
    RESTAURANT: {
        perPersonMin: 5,
        perPersonMax: 20,
        baseFlatUSD: 10,
    },
    SALON: {
        percentageMin: 0.20,
        percentageMax: 0.30,
        baseFlatUSD: 8,
    },
    SPA: {
        percentageMin: 0.20,
        percentageMax: 0.30,
        baseFlatUSD: 10,
    },
    EVENT_VENUE: {
        perTicketMin: 10,
        perTicketMax: 50,
        baseFlatUSD: 20,
    },
    OTHER: {
        baseFlatUSD: 5,
    },
};
class NoShowPredictor {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
    }
    /**
     * Predict no-show probability for a reservation
     */
    async predict(features) {
        try {
            // 1. Try DashScope AI API first
            const apiKey = process.env.DASHSCOPE_API_KEY;
            if (apiKey && apiKey !== 'REPLACE_WITH_YOUR_DASHSCOPE_API_KEY') {
                try {
                    const prompt = `
            Analyze this reservation data and predict the no-show probability for a premium booking platform globally.
            Customer History: ${JSON.stringify(features.customerHistory || {})}
            Time Factors: ${JSON.stringify(features.timeFactors || {})}
            Booking Factors: ${JSON.stringify(features.bookingFactors || {})}
            Business Factors: ${JSON.stringify(features.businessFactors || {})}
            
            Return ONLY a valid JSON object with this exact structure (no markdown, no markdown backticks):
            {
              "riskScore": <number between 0 and 100>,
              "factors": { "<reason_string>": <positive_or_negative_number_impact> }
            }
          `;
                    const response = await axios_1.default.post('https://ws-ueieid4zr4rlge79.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
                        model: 'qwen-turbo',
                        input: {
                            messages: [
                                { role: 'system', content: 'You are an AI predictive risk analysis system. Only output JSON.' },
                                { role: 'user', content: prompt }
                            ]
                        },
                        parameters: {
                            result_format: 'message'
                        }
                    }, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    if (response.data?.output?.choices?.length > 0) {
                        const aiText = response.data.output.choices[0].message.content.trim();
                        const cleaned = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const aiResult = JSON.parse(cleaned);
                        const riskScore = Math.max(0, Math.min(100, aiResult.riskScore || 30));
                        const probability = riskScore / 100;
                        const factors = aiResult.factors || {};
                        const riskLevel = this.getRiskLevel(riskScore);
                        const depositRecommendation = this.calculateDynamicDeposit(features, riskScore);
                        const overbookingAdvice = features.businessFactors?.businessCategory === 'EVENT_VENUE'
                            ? this.calculateOverbookingAdvice(features, riskScore)
                            : undefined;
                        return { probability, riskScore, riskLevel, factors, depositRecommendation, overbookingAdvice };
                    }
                }
                catch (apiError) {
                    logger_1.logger.error(`[DashScope] Failed prediction API call, falling back to heuristic ML: ${apiError.message}`);
                }
            }
            // If DashScope is not available, try ML model or fall back to rule-based
            if (!this.isModelLoaded) {
                return this.ruleBasedPrediction(features);
            }
            // Normalize features
            const normalizedFeatures = this.normalizeFeatures(features);
            // Make prediction using ML model
            const prediction = this.model.predict(tf.tensor2d([normalizedFeatures]));
            const predictionTensor = Array.isArray(prediction)
                ? prediction[0]
                : prediction;
            const data = await predictionTensor.data();
            const probability = data[0] ?? 0;
            const riskScore = Math.round(probability * 100);
            const factors = this.extractFactors(features);
            const riskLevel = this.getRiskLevel(riskScore);
            const depositRecommendation = this.calculateDynamicDeposit(features, riskScore);
            return { probability, riskScore, riskLevel, factors, depositRecommendation };
        }
        catch (error) {
            logger_1.logger.error('Error in AI prediction, falling back to rule-based', error);
            return this.ruleBasedPrediction(features);
        }
    }
    /**
     * Rule-based prediction with industry-specific modifiers
     */
    ruleBasedPrediction(features) {
        let riskScore = 30; // Base risk
        const factors = {};
        // ── Customer history factors ──
        if (features.customerHistory) {
            const { totalReservations, noShowCount, averageNoShowRate } = features.customerHistory;
            if (totalReservations === 0) {
                riskScore += 15; // New customer
                factors.isNewCustomer = 15;
            }
            else if (averageNoShowRate) {
                riskScore += averageNoShowRate * 40;
                factors.customerHistory = Math.round(averageNoShowRate * 40);
            }
            if (noShowCount > 0) {
                const noShowRate = noShowCount / totalReservations;
                riskScore += noShowRate * 30;
                factors.pastNoShows = Math.round(noShowRate * 30);
            }
            // Loyal customer discount: lots of completed, few no-shows
            if (totalReservations > 10 && (noShowCount / totalReservations) < 0.05) {
                riskScore -= 15;
                factors.loyalCustomerBonus = -15;
            }
        }
        else {
            riskScore += 20; // Unknown customer
            factors.unknownCustomer = 20;
        }
        // ── Time factors ──
        if (features.timeFactors) {
            const { hour, isWeekend } = features.timeFactors;
            if (isWeekend) {
                riskScore += 5;
                factors.weekendBooking = 5;
            }
            // Late night or very early bookings might have higher no-show
            if (hour < 9 || hour > 21) {
                riskScore += 10;
                factors.unusualTime = 10;
            }
        }
        // ── Booking factors ──
        if (features.bookingFactors) {
            const { advanceBookingDays, isSameDay, groupSize } = features.bookingFactors;
            if (isSameDay) {
                riskScore += 15;
                factors.sameDayBooking = 15;
            }
            else if (advanceBookingDays > 14) {
                riskScore += 10;
                factors.advancedBooking = 10;
            }
            if (groupSize > 8) {
                riskScore += 8;
                factors.largeGroup = 8;
            }
        }
        // ── Business factors ──
        if (features.businessFactors) {
            const { averageNoShowRate, businessRating } = features.businessFactors;
            riskScore += averageNoShowRate * 20;
            factors.businessAverage = Math.round(averageNoShowRate * 20);
            // Adjust risk based on business rating/reliability
            if (businessRating && businessRating < 3.5) {
                riskScore += 10;
                factors.lowBusinessRating = 10;
            }
            // ── INDUSTRY-SPECIFIC MODIFIERS ──
            const category = features.businessFactors.businessCategory;
            if (category) {
                const industryAdjustment = this.industrySpecificPrediction(features, category);
                riskScore += industryAdjustment.totalAdjustment;
                Object.assign(factors, industryAdjustment.factors);
            }
        }
        // ── Deposit deterrence factor ──
        // If a deposit is already required, risk drops (people who pay are more likely to show)
        if (features.businessFactors?.requiresDeposit) {
            riskScore -= 12;
            factors.depositDeterrent = -12;
        }
        // Cap risk score between 0 and 100
        riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));
        const probability = riskScore / 100;
        const riskLevel = this.getRiskLevel(riskScore);
        const depositRecommendation = this.calculateDynamicDeposit(features, riskScore);
        // Overbooking advice for events
        const overbookingAdvice = features.businessFactors?.businessCategory === 'EVENT_VENUE'
            ? this.calculateOverbookingAdvice(features, riskScore)
            : undefined;
        return { probability, riskScore, riskLevel, factors, depositRecommendation, overbookingAdvice };
    }
    /**
     * Industry-specific risk adjustments
     */
    industrySpecificPrediction(features, category) {
        const factors = {};
        let totalAdjustment = 0;
        switch (category) {
            case 'RESTAURANT': {
                const dayOfWeek = features.timeFactors?.dayOfWeek;
                const groupSize = features.bookingFactors?.groupSize || 1;
                const hour = features.timeFactors?.hour || 12;
                // Friday night large groups are highest no-show risk in restaurants
                if (dayOfWeek === 5 && hour >= 19 && groupSize >= 6) {
                    totalAdjustment += 12;
                    factors.fridayNightLargeGroup = 12;
                }
                // Tuesday couples tend to be reliable
                if (dayOfWeek === 2 && groupSize <= 2) {
                    totalAdjustment -= 5;
                    factors.weekdayCoupleReliable = -5;
                }
                // Prime dinner hours (7-9 PM) on weekends = higher demand = higher no-show
                if (features.timeFactors?.isWeekend && hour >= 19 && hour <= 21) {
                    totalAdjustment += 7;
                    factors.primeTimeDinner = 7;
                }
                // Very large groups (10+) in restaurants have notoriously high no-show
                if (groupSize >= 10) {
                    totalAdjustment += 10;
                    factors.veryLargeGroupRestaurant = 10;
                }
                break;
            }
            case 'SALON':
            case 'SPA': {
                const duration = features.serviceFactors?.serviceDurationMinutes || 60;
                const serviceValue = features.serviceFactors?.estimatedValueUSD || 50;
                // Multi-hour services (2+ hours) are higher risk: more commitment, more likely to bail
                if (duration >= 120) {
                    totalAdjustment += 10;
                    factors.multiHourService = 10;
                }
                // High-value services (>PKR 5000) = higher risk without deposit
                if (serviceValue > 5000) {
                    totalAdjustment += 8;
                    factors.highValueService = 8;
                }
                // Peak hours for salons (Thursday/Friday before weekend)
                const dayOfWeek = features.timeFactors?.dayOfWeek;
                if (dayOfWeek === 4 || dayOfWeek === 5) {
                    totalAdjustment += 5;
                    factors.salonPeakDay = 5;
                }
                // Time slot fragility: a single missed appointment affects the stylist's entire day
                if (duration >= 90) {
                    totalAdjustment += 5;
                    factors.timeSlotFragility = 5;
                }
                break;
            }
            case 'EVENT_VENUE': {
                const isVIP = features.eventFactors?.isVIP || false;
                const ticketPrice = features.eventFactors?.ticketPriceUSD || 20;
                // VIP bookings have moderate no-show (people book speculatively)
                if (isVIP) {
                    totalAdjustment += 8;
                    factors.vipSpeculativeBooking = 8;
                }
                // High ticket price can actually reduce no-show (sunk cost)
                if (ticketPrice > 100) {
                    totalAdjustment -= 5;
                    factors.highTicketCommitment = -5;
                }
                // Free or very cheap events have highest no-show
                if (ticketPrice < 10) {
                    totalAdjustment += 15;
                    factors.lowPriceHighNoShow = 15;
                }
                // Long advance bookings for events decay more
                const advanceDays = features.bookingFactors?.advanceBookingDays || 0;
                if (advanceDays > 30) {
                    totalAdjustment += 8;
                    factors.eventAdvanceDecay = 8;
                }
                break;
            }
            case 'CLINIC':
            case 'FITNESS_CENTER':
            default:
                // Generic adjustments for other categories
                break;
        }
        return { totalAdjustment, factors };
    }
    /**
     * Calculate dynamic deposit based on risk, industry, and service value.
     * All deposits are credited toward the total purchase.
     */
    calculateDynamicDeposit(features, riskScore) {
        const category = features.businessFactors?.businessCategory || 'OTHER';
        const groupSize = features.bookingFactors?.groupSize || 1;
        // Trusted customers (score < 25 OR loyal history) get deposit waived
        const isLoyalCustomer = features.customerHistory
            && features.customerHistory.totalReservations > 10
            && (features.customerHistory.noShowCount / features.customerHistory.totalReservations) < 0.05;
        if (riskScore < 25 || isLoyalCustomer) {
            return {
                required: false,
                amountUSD: 0,
                strategy: 'AI_DYNAMIC',
                reason: isLoyalCustomer
                    ? 'Trusted returning customer — deposit waived as loyalty reward'
                    : 'Low risk — no deposit needed',
                creditedTowardPurchase: true,
            };
        }
        // Risk multiplier: scales deposit proportionally (0.5 at risk 30, up to 1.5 at risk 100)
        const riskMultiplier = 0.3 + (riskScore / 100) * 1.2;
        let amountUSD = 0;
        let reason = '';
        const config = DEPOSIT_CONFIG;
        switch (category) {
            case 'RESTAURANT': {
                let perPerson = config.RESTAURANT.baseFlatUSD * riskMultiplier;
                perPerson = Math.max(config.RESTAURANT.perPersonMin, Math.min(perPerson, config.RESTAURANT.perPersonMax));
                amountUSD = perPerson * groupSize;
                reason = `$${Math.round(perPerson)}/person × ${groupSize} guests (risk-adjusted)`;
                break;
            }
            case 'SALON':
            case 'SPA': {
                const c = category === 'SPA' ? config.SPA : config.SALON;
                const serviceValue = features.serviceFactors?.estimatedValueUSD || 50;
                const percentage = c.percentageMin + (riskMultiplier - 1) * (c.percentageMax - c.percentageMin);
                amountUSD = Math.round(serviceValue * percentage);
                amountUSD = Math.max(amountUSD, c.baseFlatUSD);
                reason = `${Math.round(percentage * 100)}% of $${serviceValue.toLocaleString()} service value`;
                break;
            }
            case 'EVENT_VENUE': {
                const ticketPrice = features.eventFactors?.ticketPriceUSD || 20;
                const isVIP = features.eventFactors?.isVIP || false;
                amountUSD = Math.round((ticketPrice * (isVIP ? 0.5 : 0.3)) * riskMultiplier * groupSize);
                amountUSD = Math.min(amountUSD, config.EVENT_VENUE.perTicketMax * groupSize);
                amountUSD = Math.max(amountUSD, config.EVENT_VENUE.perTicketMin);
                reason = `Event booking deposit (risk-adjusted, capped at 50% of ticket)`;
                break;
            }
            default: {
                amountUSD = Math.round(config.OTHER.baseFlatUSD * riskMultiplier);
                reason = `Standard deposit (AI risk: ${riskScore}%)`;
                break;
            }
        }
        // Ensure minimum USD 5
        amountUSD = Math.max(Math.round(amountUSD), 5);
        return {
            required: riskScore >= 35,
            amountUSD,
            strategy: 'AI_DYNAMIC',
            reason,
            creditedTowardPurchase: true,
        };
    }
    /**
     * Overbooking advice for event venues
     */
    calculateOverbookingAdvice(features, riskScore) {
        const capacity = features.eventFactors?.eventCapacity || 100;
        const predictedNoShowPercent = Math.min(riskScore * 0.8, 30); // Cap at 30%
        const safeOverbookMargin = Math.round(predictedNoShowPercent * 0.7); // Conservative: 70% of predicted
        const recommendedCapacity = Math.round(capacity * (1 + safeOverbookMargin / 100));
        return {
            predictedNoShowPercent: Math.round(predictedNoShowPercent * 10) / 10,
            safeOverbookMargin: Math.round(safeOverbookMargin),
            recommendedCapacity,
        };
    }
    /**
     * Map score to risk level
     */
    getRiskLevel(score) {
        if (score >= 75)
            return 'CRITICAL';
        if (score >= 50)
            return 'HIGH';
        if (score >= 30)
            return 'MODERATE';
        return 'LOW';
    }
    /**
     * Normalize features for ML model input
     */
    normalizeFeatures(features) {
        // Feature vector: [totalReservations, noShowRate, dayOfWeek, hour, advanceDays, groupSize, ...]
        const normalized = [];
        // Customer history
        if (features.customerHistory) {
            normalized.push(features.customerHistory.totalReservations / 100); // Normalize
            normalized.push(features.customerHistory.averageNoShowRate || 0);
        }
        else {
            normalized.push(0, 0);
        }
        // Time factors
        if (features.timeFactors) {
            normalized.push(features.timeFactors.dayOfWeek / 7);
            normalized.push(features.timeFactors.hour / 24);
            normalized.push(features.timeFactors.isWeekend ? 1 : 0);
        }
        else {
            normalized.push(0, 0, 0);
        }
        // Booking factors
        if (features.bookingFactors) {
            normalized.push(Math.min(features.bookingFactors.advanceBookingDays / 30, 1));
            normalized.push(features.bookingFactors.groupSize / 20);
            normalized.push(features.bookingFactors.hasSpecialRequests ? 1 : 0);
        }
        else {
            normalized.push(0, 0, 0);
        }
        return normalized;
    }
    /**
     * Extract factor contributions for explanation
     */
    extractFactors(features) {
        const factors = {};
        if (features.customerHistory?.averageNoShowRate) {
            factors.customerHistory = features.customerHistory.averageNoShowRate;
        }
        if (features.bookingFactors?.isSameDay) {
            factors.sameDayBooking = 0.15;
        }
        if (features.timeFactors?.isWeekend) {
            factors.weekendBooking = 0.05;
        }
        return factors;
    }
    /**
     * Load ML model (placeholder for actual model loading)
     */
    async loadModel() {
        try {
            // In production, load a trained TensorFlow.js model
            // For now, use rule-based prediction
            this.isModelLoaded = false;
            logger_1.logger.info('Using rule-based no-show prediction');
        }
        catch (error) {
            logger_1.logger.warn('Could not load ML model, using rule-based prediction', error);
            this.isModelLoaded = false;
        }
    }
    /**
     * Get customer reservation history for prediction
     */
    async getCustomerHistory(customerId, businessId) {
        const whereClause = { customerId };
        if (businessId) {
            whereClause.businessId = businessId;
        }
        const [total, noShows, cancellations, lastReservation] = await Promise.all([
            database_1.prisma.reservation.count({ where: whereClause }),
            database_1.prisma.reservation.count({
                where: { ...whereClause, status: 'NO_SHOW' },
            }),
            database_1.prisma.reservation.count({
                where: { ...whereClause, status: 'CANCELLED' },
            }),
            database_1.prisma.reservation.findFirst({
                where: whereClause,
                orderBy: { reservationDate: 'desc' },
                select: { reservationDate: true },
            }),
        ]);
        const averageNoShowRate = total > 0 ? noShows / total : 0;
        return {
            totalReservations: total,
            noShowCount: noShows,
            cancellationCount: cancellations,
            lastReservationDate: lastReservation?.reservationDate,
            averageNoShowRate,
        };
    }
    /**
     * Get business average no-show rate
     */
    async getBusinessNoShowRate(businessId) {
        const [total, noShows] = await Promise.all([
            database_1.prisma.reservation.count({
                where: {
                    businessId,
                    status: { in: ['NO_SHOW', 'COMPLETED', 'CANCELLED'] },
                },
            }),
            database_1.prisma.reservation.count({
                where: { businessId, status: 'NO_SHOW' },
            }),
        ]);
        return total > 0 ? noShows / total : 0.15; // Default 15% if no data
    }
    /**
     * Get aggregated no-show analytics by day of week for a business
     */
    async getNoShowByDayOfWeek(businessId) {
        const reservations = await database_1.prisma.reservation.findMany({
            where: {
                businessId,
                status: { in: ['COMPLETED', 'NO_SHOW'] },
            },
            select: {
                reservationDate: true,
                status: true,
            },
        });
        const dayStats = {};
        for (let d = 0; d <= 6; d++) {
            dayStats[d] = { total: 0, noShows: 0 };
        }
        for (const r of reservations) {
            const day = new Date(r.reservationDate).getDay();
            dayStats[day].total++;
            if (r.status === 'NO_SHOW')
                dayStats[day].noShows++;
        }
        return Object.entries(dayStats).map(([day, stats]) => ({
            day: Number(day),
            total: stats.total,
            noShows: stats.noShows,
            rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
        }));
    }
    /**
     * Get no-show analytics by hour of day for heatmap
     */
    async getNoShowByHour(businessId) {
        const reservations = await database_1.prisma.reservation.findMany({
            where: {
                businessId,
                status: { in: ['COMPLETED', 'NO_SHOW'] },
            },
            select: {
                reservationTime: true,
                status: true,
            },
        });
        const hourStats = {};
        for (let h = 0; h <= 23; h++) {
            hourStats[h] = { total: 0, noShows: 0 };
        }
        for (const r of reservations) {
            const hour = parseInt(r.reservationTime.split(':')[0], 10);
            if (!isNaN(hour)) {
                hourStats[hour].total++;
                if (r.status === 'NO_SHOW')
                    hourStats[hour].noShows++;
            }
        }
        return Object.entries(hourStats).map(([hour, stats]) => ({
            hour: Number(hour),
            total: stats.total,
            noShows: stats.noShows,
            rate: stats.total > 0 ? Math.round((stats.noShows / stats.total) * 100) : 0,
        }));
    }
}
exports.NoShowPredictor = NoShowPredictor;
exports.noShowPredictor = new NoShowPredictor();
//# sourceMappingURL=noShowPredictor.js.map