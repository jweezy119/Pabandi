"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchGenerateMatches = exports.getStats = exports.recordFeedback = exports.getInsights = exports.getProfile = exports.upsertProfile = exports.getRecommendedInvestors = exports.getRecommendations = void 0;
const database_1 = require("../utils/database");
const apiResponse_1 = require("../utils/apiResponse");
const logger_1 = require("../utils/logger");
const mudarabahMatcher_1 = require("../services/mudarabahMatcher");
// ── Helpers ───────────────────────────────────────────────────────────
async function getPoolsWithBusiness() {
    return database_1.prisma.mudarabahPool.findMany({
        where: { status: { in: ['OPEN', 'ACTIVE', 'FULLY_SUBSCRIBED'] } },
        include: {
            business: {
                select: { city: true, state: true, country: true, rating: true, trustScore: true },
            },
        },
    });
}
async function mapPoolToMatcherPool(pool) {
    return {
        id: pool.id,
        businessId: pool.businessId,
        title: pool.title,
        description: pool.description,
        category: pool.category,
        expectedApy: pool.expectedApy,
        riskBand: pool.riskBand,
        profitShareRatio: pool.profitShareRatio,
        targetAmount: pool.targetAmount,
        currentAmount: pool.currentAmount,
        minInvestment: pool.minInvestment,
        maxInvestment: pool.maxInvestment ?? undefined,
        status: pool.status,
        city: pool.business?.city || undefined,
        state: pool.business?.state || undefined,
        country: pool.business?.country || undefined,
        viewCount: pool.viewCount,
        featured: pool.featured,
        rating: pool.business?.rating ?? undefined,
        trustScore: pool.business?.trustScore ?? undefined,
    };
}
// ── GET /recommendations ──────────────────────────────────────────────
const getRecommendations = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 10;
        // Get or compute investor profile
        let profile = await database_1.prisma.investorProfile.findUnique({ where: { userId } });
        if (!profile) {
            // Cold-start: compute from trust score
            const user = await database_1.prisma.user.findUnique({
                where: { id: userId },
                select: { trustScore: true, business: { select: { city: true } } },
            });
            if (!user)
                return (0, apiResponse_1.fail)(res, 'User not found', 404);
            const investments = await database_1.prisma.mudarabahInvestment.findMany({
                where: { investorId: userId },
                include: { pool: { include: { business: true } } },
            });
            const computed = (0, mudarabahMatcher_1.computeInvestorProfile)(investments.map(i => ({ poolId: i.poolId, amount: i.amount, status: i.status, pool: i.pool })), user.trustScore, user.business?.city || undefined);
            // Persist computed profile
            profile = await database_1.prisma.investorProfile.create({
                data: {
                    userId,
                    preferredRiskBands: computed.preferredRiskBands,
                    preferredCategories: computed.preferredCategories,
                    preferredRegions: computed.preferredRegions,
                    minApy: computed.minApy,
                    maxApy: computed.maxApy,
                    minInvestment: computed.minInvestment,
                    maxInvestment: computed.maxInvestment,
                    preferredRatios: computed.preferredRatios,
                    riskToleranceScore: computed.riskToleranceScore,
                    investmentStyle: computed.investmentStyle,
                    diversificationScore: computed.diversificationScore,
                    totalInvested: computed.totalInvested,
                    totalPoolsInvested: computed.totalPoolsInvested,
                    avgInvestmentAmount: computed.avgInvestmentAmount,
                    profileComplete: computed.totalPoolsInvested > 0,
                },
            });
        }
        // Get pools
        const rawPools = await getPoolsWithBusiness();
        const excludePoolIds = await database_1.prisma.mudarabahInvestment.findMany({
            where: { investorId: userId, status: 'ACTIVE' },
            select: { poolId: true },
        }).then(rows => rows.map(r => r.poolId));
        const pools = await Promise.all(rawPools.map(mapPoolToMatcherPool));
        const profileObj = {
            preferredRiskBands: profile.preferredRiskBands,
            preferredCategories: profile.preferredCategories,
            preferredRegions: profile.preferredRegions,
            minApy: profile.minApy,
            maxApy: profile.maxApy,
            minInvestment: profile.minInvestment,
            maxInvestment: profile.maxInvestment,
            preferredRatios: profile.preferredRatios,
            riskToleranceScore: profile.riskToleranceScore,
            investmentStyle: profile.investmentStyle,
            diversificationScore: profile.diversificationScore,
            totalInvested: profile.totalInvested,
            totalPoolsInvested: profile.totalPoolsInvested,
            avgInvestmentAmount: profile.avgInvestmentAmount,
        };
        const recommendations = (0, mudarabahMatcher_1.recommendPoolsForInvestor)(pools, profileObj, {
            limit,
            excludePoolIds,
            investorCity: profile.preferredRegions[0] || undefined,
        });
        return (0, apiResponse_1.ok)(res, {
            profile: {
                style: profile.investmentStyle,
                riskTolerance: profile.riskToleranceScore,
                diversificationScore: profile.diversificationScore,
            },
            recommendations: recommendations.map(r => ({
                poolId: r.pool.id,
                title: r.pool.title,
                category: r.pool.category,
                expectedApy: r.pool.expectedApy,
                riskBand: r.pool.riskBand,
                score: r.score,
                factors: r.factors,
                reasons: r.reasons,
            })),
        });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] getRecommendations error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to get recommendations', 500);
    }
};
exports.getRecommendations = getRecommendations;
// ── GET /investors/:poolId ─────────────────────────────────────────────
const getRecommendedInvestors = async (req, res) => {
    try {
        const userId = req.user.id;
        const { poolId } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        // Verify pool exists and belongs to user
        const pool = await database_1.prisma.mudarabahPool.findUnique({
            where: { id: poolId },
            include: { business: true },
        });
        if (!pool)
            return (0, apiResponse_1.fail)(res, 'Pool not found', 404);
        // Check ownership (business owner)
        if (pool.business?.ownerId !== userId) {
            return (0, apiResponse_1.fail)(res, 'Only pool owner can view recommended investors', 403);
        }
        // Get all investor profiles
        const allProfiles = await database_1.prisma.investorProfile.findMany({
            include: { user: { select: { id: true, business: { select: { city: true, country: true } } } } },
        });
        const matcherPool = await mapPoolToMatcherPool(pool);
        const investors = allProfiles.map(p => ({
            userId: p.userId,
            profile: {
                preferredRiskBands: p.preferredRiskBands,
                preferredCategories: p.preferredCategories,
                preferredRegions: p.preferredRegions,
                minApy: p.minApy,
                maxApy: p.maxApy,
                minInvestment: p.minInvestment,
                maxInvestment: p.maxInvestment,
                preferredRatios: p.preferredRatios,
                riskToleranceScore: p.riskToleranceScore,
                investmentStyle: p.investmentStyle,
                diversificationScore: p.diversificationScore,
                totalInvested: p.totalInvested,
                totalPoolsInvested: p.totalPoolsInvested,
                avgInvestmentAmount: p.avgInvestmentAmount,
            },
            city: p.user.business?.city || p.preferredRegions[0] || undefined,
            country: p.user.business?.country || undefined,
        }));
        const scored = (0, mudarabahMatcher_1.recommendInvestorsForPool)(matcherPool, investors, { limit });
        // Upsert matches into DB
        const matchRecords = (0, mudarabahMatcher_1.generateMatchesForPool)(matcherPool, investors, { limit });
        await Promise.all(matchRecords.map(m => database_1.prisma.businessInvestorMatch.upsert({
            where: { poolId_investorId: { poolId: m.poolId, investorId: m.investorId } },
            create: m,
            update: { matchScore: m.matchScore, matchReasons: m.matchReasons, matchFactors: m.matchFactors },
        })));
        return (0, apiResponse_1.ok)(res, {
            poolId,
            investors: scored.map(s => ({
                investorId: s.investorId,
                score: s.score,
                factors: s.factors,
                reasons: s.reasons,
                investmentStyle: s.profile.investmentStyle,
                totalInvested: s.profile.totalInvested,
            })),
        });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] getRecommendedInvestors error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to get investor recommendations', 500);
    }
};
exports.getRecommendedInvestors = getRecommendedInvestors;
// ── POST /profile ─────────────────────────────────────────────────────
const upsertProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { preferredRiskBands, preferredCategories, preferredRegions, minApy, maxApy, minInvestment, maxInvestment, preferredRatios, } = req.body;
        // Validate risk bands
        const validBands = ['LOW', 'MEDIUM', 'HIGH'];
        if (preferredRiskBands && !Array.isArray(preferredRiskBands)) {
            return (0, apiResponse_1.fail)(res, 'preferredRiskBands must be an array', 400);
        }
        if (preferredRiskBands && preferredRiskBands.some((b) => !validBands.includes(b.toUpperCase()))) {
            return (0, apiResponse_1.fail)(res, `Invalid risk band. Valid: ${validBands.join(', ')}`, 400);
        }
        const existing = await database_1.prisma.investorProfile.findUnique({ where: { userId } });
        const data = {
            preferredRiskBands: preferredRiskBands?.map((b) => b.toUpperCase()) ?? existing?.preferredRiskBands ?? ['LOW', 'MEDIUM'],
            preferredCategories: preferredCategories ?? existing?.preferredCategories ?? [],
            preferredRegions: preferredRegions ?? existing?.preferredRegions ?? [],
            minApy: minApy ?? existing?.minApy ?? 5.0,
            maxApy: maxApy ?? existing?.maxApy ?? 50.0,
            minInvestment: minInvestment ?? existing?.minInvestment ?? 100,
            maxInvestment: maxInvestment ?? existing?.maxInvestment ?? 10000,
            preferredRatios: preferredRatios ?? existing?.preferredRatios ?? ['70/30', '60/40'],
            profileComplete: true,
        };
        const profile = await database_1.prisma.investorProfile.upsert({
            where: { userId },
            create: { userId, ...data },
            update: data,
        });
        // Recompute scores based on updated preferences
        const user = await database_1.prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
        const investments = await database_1.prisma.mudarabahInvestment.findMany({
            where: { investorId: userId },
            include: { pool: { include: { business: true } } },
        });
        const computed = (0, mudarabahMatcher_1.computeInvestorProfile)(investments.map(i => ({ poolId: i.poolId, amount: i.amount, status: i.status, pool: i.pool })), user?.trustScore ?? 50);
        await database_1.prisma.investorProfile.update({
            where: { userId },
            data: {
                riskToleranceScore: computed.riskToleranceScore,
                investmentStyle: computed.investmentStyle,
                diversificationScore: computed.diversificationScore,
                totalInvested: computed.totalInvested,
                totalPoolsInvested: computed.totalPoolsInvested,
                avgInvestmentAmount: computed.avgInvestmentAmount,
            },
        });
        return (0, apiResponse_1.ok)(res, {
            ...profile,
            riskToleranceScore: computed.riskToleranceScore,
            investmentStyle: computed.investmentStyle,
            diversificationScore: computed.diversificationScore,
        });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] upsertProfile error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to update profile', 500);
    }
};
exports.upsertProfile = upsertProfile;
// ── GET /profile ──────────────────────────────────────────────────────
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await database_1.prisma.investorProfile.findUnique({ where: { userId } });
        if (!profile) {
            return (0, apiResponse_1.ok)(res, {
                profileComplete: false,
                investmentStyle: 'MODERATE',
                riskToleranceScore: 50,
                message: 'No profile found. Complete your preferences to get personalized recommendations.',
            });
        }
        return (0, apiResponse_1.ok)(res, profile);
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] getProfile error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to get profile', 500);
    }
};
exports.getProfile = getProfile;
// ── GET /insights ─────────────────────────────────────────────────────
const getInsights = async (req, res) => {
    try {
        const userId = req.user.id;
        const profile = await database_1.prisma.investorProfile.findUnique({ where: { userId } });
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { trustScore: true, business: { select: { city: true } } },
        });
        const investorCity = profile?.preferredRegions?.[0] || user?.business?.city || undefined;
        // Compute profile if missing
        let profileObj = profile ? {
            preferredRiskBands: profile.preferredRiskBands,
            preferredCategories: profile.preferredCategories,
            preferredRegions: profile.preferredRegions,
            minApy: profile.minApy,
            maxApy: profile.maxApy,
            minInvestment: profile.minInvestment,
            maxInvestment: profile.maxInvestment,
            preferredRatios: profile.preferredRatios,
            riskToleranceScore: profile.riskToleranceScore,
            investmentStyle: profile.investmentStyle,
            diversificationScore: profile.diversificationScore,
            totalInvested: profile.totalInvested,
            totalPoolsInvested: profile.totalPoolsInvested,
            avgInvestmentAmount: profile.avgInvestmentAmount,
        } : {
            preferredRiskBands: ['LOW', 'MEDIUM'],
            preferredCategories: [],
            preferredRegions: investorCity ? [investorCity] : [],
            minApy: 5,
            maxApy: 50,
            minInvestment: 100,
            maxInvestment: 10000,
            preferredRatios: ['70/30', '60/40'],
            riskToleranceScore: 50,
            investmentStyle: 'MODERATE',
            diversificationScore: 50,
            totalInvested: 0,
            totalPoolsInvested: 0,
            avgInvestmentAmount: 0,
        };
        const rawPools = await getPoolsWithBusiness();
        const pools = await Promise.all(rawPools.map(mapPoolToMatcherPool));
        const scored = (0, mudarabahMatcher_1.recommendPoolsForInvestor)(pools, profileObj, { limit: 5, investorCity });
        const insights = (0, mudarabahMatcher_1.generateInsights)(profileObj, pools, scored, investorCity);
        return (0, apiResponse_1.ok)(res, { insights });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] getInsights error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to get insights', 500);
    }
};
exports.getInsights = getInsights;
// ── POST /feedback ────────────────────────────────────────────────────
const recordFeedback = async (req, res) => {
    try {
        const userId = req.user.id;
        const { poolId, viewed, saved, invested } = req.body;
        if (!poolId)
            return (0, apiResponse_1.fail)(res, 'poolId is required', 400);
        const match = await database_1.prisma.businessInvestorMatch.findUnique({
            where: { poolId_investorId: { poolId, investorId: userId } },
        });
        if (!match) {
            // Create a new match record with feedback
            await database_1.prisma.businessInvestorMatch.create({
                data: {
                    poolId,
                    investorId: userId,
                    matchScore: 0,
                    matchReasons: [],
                    matchFactors: {},
                    investorViewed: !!viewed,
                    investorSaved: !!saved,
                    investorInvested: !!invested,
                },
            });
        }
        else {
            await database_1.prisma.businessInvestorMatch.update({
                where: { id: match.id },
                data: {
                    investorViewed: viewed !== undefined ? viewed : match.investorViewed,
                    investorSaved: saved !== undefined ? saved : match.investorSaved,
                    investorInvested: invested !== undefined ? invested : match.investorInvested,
                },
            });
        }
        // Update investor profile stats if invested
        if (invested) {
            const profile = await database_1.prisma.investorProfile.findUnique({ where: { userId } });
            if (profile) {
                await database_1.prisma.investorProfile.update({
                    where: { userId },
                    data: {
                        totalPoolsInvested: profile.totalPoolsInvested + 1,
                        lastInvestmentAt: new Date(),
                    },
                });
            }
        }
        return (0, apiResponse_1.ok)(res, { recorded: true });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] recordFeedback error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to record feedback', 500);
    }
};
exports.recordFeedback = recordFeedback;
// ── GET /stats ────────────────────────────────────────────────────────
const getStats = async (req, res) => {
    try {
        const totalMatches = await database_1.prisma.businessInvestorMatch.count();
        const viewedCount = await database_1.prisma.businessInvestorMatch.count({ where: { investorViewed: true } });
        const savedCount = await database_1.prisma.businessInvestorMatch.count({ where: { investorSaved: true } });
        const investedCount = await database_1.prisma.businessInvestorMatch.count({ where: { investorInvested: true } });
        const poolCount = await database_1.prisma.mudarabahPool.count({ where: { status: { in: ['OPEN', 'ACTIVE'] } } });
        const investorCount = await database_1.prisma.investorProfile.count();
        const avgMatchesPerPool = poolCount > 0 ? totalMatches / poolCount : 0;
        const conversionRate = viewedCount > 0 ? (investedCount / viewedCount) * 100 : 0;
        return (0, apiResponse_1.ok)(res, {
            totalMatches,
            poolCount,
            investorCount,
            avgMatchesPerPool: Math.round(avgMatchesPerPool * 100) / 100,
            viewRate: totalMatches > 0 ? Math.round((viewedCount / totalMatches) * 100) : 0,
            saveRate: viewedCount > 0 ? Math.round((savedCount / viewedCount) * 100) : 0,
            conversionRate: Math.round(conversionRate * 100) / 100,
            viewedCount,
            savedCount,
            investedCount,
        });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] getStats error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to get stats', 500);
    }
};
exports.getStats = getStats;
// ── Cron: Batch Generate Matches ─────────────────────────────────────
const batchGenerateMatches = async (_req, res) => {
    try {
        const pools = await database_1.prisma.mudarabahPool.findMany({
            where: { status: { in: ['OPEN', 'ACTIVE', 'FULLY_SUBSCRIBED'] } },
            include: { business: { select: { city: true, state: true, country: true } } },
        });
        const allProfiles = await database_1.prisma.investorProfile.findMany({
            include: { user: { select: { id: true, business: { select: { city: true, country: true } } } } },
        });
        const investors = allProfiles.map(p => ({
            userId: p.userId,
            profile: {
                preferredRiskBands: p.preferredRiskBands,
                preferredCategories: p.preferredCategories,
                preferredRegions: p.preferredRegions,
                minApy: p.minApy,
                maxApy: p.maxApy,
                minInvestment: p.minInvestment,
                maxInvestment: p.maxInvestment,
                preferredRatios: p.preferredRatios,
                riskToleranceScore: p.riskToleranceScore,
                investmentStyle: p.investmentStyle,
                diversificationScore: p.diversificationScore,
                totalInvested: p.totalInvested,
                totalPoolsInvested: p.totalPoolsInvested,
                avgInvestmentAmount: p.avgInvestmentAmount,
            },
            city: p.user.business?.city || p.preferredRegions[0] || undefined,
            country: p.user.business?.country || undefined,
        }));
        let totalUpserts = 0;
        for (const pool of pools) {
            const matcherPool = await mapPoolToMatcherPool(pool);
            const records = (0, mudarabahMatcher_1.generateMatchesForPool)(matcherPool, investors, { limit: 50 });
            await Promise.all(records.map(r => database_1.prisma.businessInvestorMatch.upsert({
                where: { poolId_investorId: { poolId: r.poolId, investorId: r.investorId } },
                create: r,
                update: { matchScore: r.matchScore, matchReasons: r.matchReasons, matchFactors: r.matchFactors },
            })));
            totalUpserts += records.length;
        }
        return (0, apiResponse_1.ok)(res, {
            poolsProcessed: pools.length,
            totalUpserts,
            investorsScored: investors.length,
        });
    }
    catch (error) {
        logger_1.logger.error('[mudarabahMatcher] batchGenerateMatches error:', error);
        return (0, apiResponse_1.fail)(res, error.message || 'Failed to generate batch matches', 500);
    }
};
exports.batchGenerateMatches = batchGenerateMatches;
//# sourceMappingURL=mudarabahMatcher.controller.js.map