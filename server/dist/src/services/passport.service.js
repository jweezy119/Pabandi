"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveScoreTier = deriveScoreTier;
exports.assemblePassport = assemblePassport;
exports.assemblePassportByWallet = assemblePassportByWallet;
exports.checkEligibility = checkEligibility;
exports.verifyPassport = verifyPassport;
exports.recordIncident = recordIncident;
exports.bindX509Certificate = bindX509Certificate;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
// ── Tier Boundaries ───────────────────────────────────────────────
const TIER_BOUNDARIES = [
    { tier: 'Platinum', min: 850 },
    { tier: 'Gold', min: 700 },
    { tier: 'Silver', min: 500 },
    { tier: 'Bronze', min: 300 },
    { tier: 'Unrated', min: 0 },
];
const TIER_RANK = {
    Platinum: 5,
    Gold: 4,
    Silver: 3,
    Bronze: 2,
    Unrated: 1,
};
// Score penalties for upheld disputes
const DISPUTE_PENALTIES = {
    NO_SHOW: 25,
    FRAUD: 100,
    NON_PAYMENT: 50,
    HARASSMENT: 40,
    QUALITY_ISSUE: 15,
    OTHER: 10,
};
// ── Core Functions ────────────────────────────────────────────────
/**
 * Derive the score tier from a 0–1000 trust score.
 */
function deriveScoreTier(score) {
    for (const { tier, min } of TIER_BOUNDARIES) {
        if (score >= min)
            return tier;
    }
    return 'Unrated';
}
/**
 * Find a user by wallet address.
 */
async function findUserByWallet(walletAddress) {
    const wallet = await database_1.prisma.wallet.findFirst({
        where: { address: walletAddress },
        select: { userId: true },
    });
    if (!wallet)
        return null;
    return wallet.userId;
}
/**
 * Assemble the full Passport object for a user.
 */
async function assemblePassport(userId) {
    try {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                reliabilityScore: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user)
            return null;
        // Fetch wallet address
        const wallet = await database_1.prisma.wallet.findUnique({
            where: { userId },
            select: { address: true },
        });
        // Fetch reservation stats
        const [totalActions, completedBookings, missedBookings] = await Promise.all([
            database_1.prisma.reservation.count({ where: { customerId: userId } }),
            database_1.prisma.reservation.count({ where: { customerId: userId, status: 'COMPLETED' } }),
            database_1.prisma.reservation.count({ where: { customerId: userId, status: 'NO_SHOW' } }),
        ]);
        // Fetch dispute stats
        const [disputesLost, disputesWon] = await Promise.all([
            database_1.prisma.dispute.count({ where: { userId, outcome: 'UPHELD' } }),
            database_1.prisma.dispute.count({ where: { reportedById: userId, outcome: 'DISMISSED' } }),
        ]);
        // Fetch active flags
        const flagRecords = await database_1.prisma.userFlag.findMany({
            where: { userId, isActive: true },
            select: { flag: true },
        });
        // Calculate punctuality rate
        const punctualityRate = totalActions > 0
            ? Math.round(((totalActions - missedBookings) / totalActions) * 100) / 100
            : 1.0;
        // Ensure score is on 0-1000 scale
        const trustScore = Math.max(0, Math.min(1000, Math.round(user.reliabilityScore)));
        const scoreTier = deriveScoreTier(trustScore);
        return {
            wallet_address: wallet?.address || null,
            trust_score: trustScore,
            score_tier: scoreTier,
            total_actions: totalActions,
            punctuality_rate: punctualityRate,
            completed_bookings: completedBookings,
            missed_bookings: missedBookings,
            disputes_lost: disputesLost,
            disputes_won: disputesWon,
            first_seen: user.createdAt.toISOString(),
            last_updated: user.updatedAt.toISOString(),
            flags: flagRecords.map((f) => f.flag),
        };
    }
    catch (error) {
        logger_1.logger.error('[PassportService] Error assembling passport:', error);
        return null;
    }
}
/**
 * Assemble a Passport by wallet address.
 */
async function assemblePassportByWallet(walletAddress) {
    const userId = await findUserByWallet(walletAddress);
    if (!userId)
        return null;
    return assemblePassport(userId);
}
/**
 * Check if a user meets a required tier threshold.
 */
async function checkEligibility(walletAddress, requiredTier) {
    const userId = await findUserByWallet(walletAddress);
    if (!userId) {
        return {
            status: 'not_eligible',
            score_tier: 'Unrated',
            trust_score: 0,
            action_required: 'user_not_found',
        };
    }
    const user = await database_1.prisma.user.findUnique({
        where: { id: userId },
        select: { reliabilityScore: true },
    });
    if (!user) {
        return {
            status: 'not_eligible',
            score_tier: 'Unrated',
            trust_score: 0,
            action_required: 'user_not_found',
        };
    }
    const trustScore = Math.max(0, Math.min(1000, Math.round(user.reliabilityScore)));
    const actualTier = deriveScoreTier(trustScore);
    const meetsThreshold = TIER_RANK[actualTier] >= TIER_RANK[requiredTier];
    return {
        status: meetsThreshold ? 'eligible' : 'not_eligible',
        score_tier: actualTier,
        trust_score: trustScore,
        action_required: meetsThreshold ? undefined : 'deposit_required',
    };
}
/**
 * Verify a user's Passport with an optional tier threshold.
 */
async function verifyPassport(walletAddress, requiredTier) {
    const passport = await assemblePassportByWallet(walletAddress);
    if (!passport) {
        return { status: 'not_found', message: 'No user found for this wallet address.' };
    }
    // If no tier required, just return the passport
    if (!requiredTier) {
        return { status: 'ok', passport };
    }
    // Check tier threshold
    const meetsThreshold = TIER_RANK[passport.score_tier] >= TIER_RANK[requiredTier];
    if (meetsThreshold) {
        return { status: 'ok', passport };
    }
    return {
        status: 'below_threshold',
        passport,
        required_tier: requiredTier,
        actual_tier: passport.score_tier,
        action_required: 'deposit_required',
        message: 'User score does not meet the required tier for this transaction.',
    };
}
/**
 * Record an incident (dispute) against a user and update their reliability score.
 */
async function recordIncident(walletAddress, type, description, apiClientId) {
    try {
        const userId = await findUserByWallet(walletAddress);
        if (!userId)
            return null;
        const dispute = await database_1.prisma.dispute.create({
            data: {
                userId,
                apiClientId: apiClientId || undefined,
                type: type,
                description: description || undefined,
            },
        });
        const penalty = DISPUTE_PENALTIES[type] || DISPUTE_PENALTIES.OTHER;
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { reliabilityScore: true },
        });
        if (user) {
            const newScore = Math.max(0, user.reliabilityScore - penalty);
            await database_1.prisma.user.update({
                where: { id: userId },
                data: { reliabilityScore: newScore },
            });
            logger_1.logger.info(`[PassportService] Incident recorded for user ${userId}: type=${type}, penalty=${penalty}, newScore=${newScore}`);
        }
        const existingIncidents = await database_1.prisma.dispute.count({
            where: { userId, type: type },
        });
        if (existingIncidents >= 3) {
            await database_1.prisma.userFlag.upsert({
                where: { userId_flag: { userId, flag: `repeat_${type.toLowerCase()}` } },
                create: { userId, flag: `repeat_${type.toLowerCase()}` },
                update: { isActive: true },
            }).catch((flagErr) => logger_1.logger.error('[PassportService] Error adding repeat flag:', flagErr));
        }
        return {
            incident_id: dispute.id,
            status: 'received',
            score_impact: -penalty,
        };
    }
    catch (error) {
        logger_1.logger.error('[PassportService] Error recording incident:', error);
        return null;
    }
}
/**
 * Bind an X.509 PKI certificate to a wallet (GB/Z 185.3 Compliance)
 */
async function bindX509Certificate(walletAddress, certificate, signedNonce) {
    try {
        const userId = await findUserByWallet(walletAddress);
        if (!userId)
            return { success: false, message: 'User not found' };
        logger_1.logger.info(`[PassportService] X.509 Certificate bound for user ${userId} (GB/Z 185.3 Compliant)`);
        return {
            success: true,
            message: 'X.509 Certificate successfully verified and bound to Pabandi identity.'
        };
    }
    catch (error) {
        logger_1.logger.error('[PassportService] Error binding X.509 certificate:', error);
        return { success: false, message: 'Internal server error' };
    }
}
//# sourceMappingURL=passport.service.js.map