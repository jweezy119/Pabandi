"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportPassport = exports.recordWeb3Stake = exports.recordSocialGraphSignal = exports.recordWhatsAppChannelSignal = exports.vouchForUser = exports.getPublicPassport = exports.getMyPassport = exports.computePassportScore = void 0;
exports.calculateDynamicEscrow = calculateDynamicEscrow;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function normalizeTier(score) {
    if (score >= 850)
        return 'PLATINUM';
    if (score >= 700)
        return 'GOLD';
    if (score >= 500)
        return 'SILVER';
    if (score >= 300)
        return 'BRONZE';
    return 'UNRATED';
}
const computePassportScore = async (userId, category = 'general') => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, reliabilityScore: true },
    });
    if (!user) {
        throw new Error('User not found');
    }
    const baseScore = Math.round(user.reliabilityScore || 0);
    const penalty = 0;
    const stakeBonus = 0;
    const socialBonus = 0;
    const channelBonus = 0;
    const composite = baseScore;
    const result = {
        userId,
        category,
        categoryScore: composite,
        compositeScore: composite,
        tier: normalizeTier(composite),
        penalty,
        stakeBonus,
        socialBonus,
        channelBonus,
        components: { base: baseScore, disputePenalty: penalty, stakeBonus, socialBonus, channelBonus },
    };
    try {
        await prisma.passportScoreSnapshot.create({
            data: {
                userId,
                category,
                baseScore,
                compositeScore: composite,
                tier: result.tier,
                penalty,
                stakeBonus,
                socialBonus,
                channelBonus,
                meta: { category },
            },
        });
    }
    catch (error) {
        console.warn('Passport risk snapshot persistence failed', error);
    }
    return result;
};
exports.computePassportScore = computePassportScore;
const getMyPassport = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, reliabilityScore: true },
    });
    if (!user)
        throw new Error('User not found');
    const trustScore = Math.round(user.reliabilityScore || 0);
    const axes = await Promise.all(['hospitality', 'live_selling', 'freelance', 'gig', 'general'].map((category) => (0, exports.computePassportScore)(userId, category)));
    const tier = axes[axes.length - 1];
    const flagsCount = await prisma.userFlag.count({
        where: { userId, isActive: true },
    });
    return {
        owner: userId,
        trustScore,
        axes,
        tier,
        activeStake: 0,
        activeFlags: flagsCount,
        exportUrl: `/api/v1/passport/export?userId=${encodeURIComponent(userId)}`,
    };
};
exports.getMyPassport = getMyPassport;
const getPublicPassport = async (userId) => {
    const my = await (0, exports.getMyPassport)(userId);
    return {
        owner: my.owner,
        trustScore: my.trustScore,
        tier: my.tier,
        activeFlags: my.activeFlags,
        axes: my.axes.map((axis) => ({
            category: axis.category,
            compositeScore: axis.compositeScore,
            tier: axis.tier,
        })),
    };
};
exports.getPublicPassport = getPublicPassport;
const vouchForUser = async (sourceUserId, targetUserId) => {
    const allCategories = ['general', 'hospitality', 'live_selling', 'freelance', 'gig'];
    const axis = await (0, exports.computePassportScore)(targetUserId, 'general');
    try {
        await prisma.socialGraphSignal.create({
            data: {
                userId: targetUserId,
                sourceUserId: sourceUserId,
                signalCategory: 'vouch',
                scoreDelta: 0,
                newCompositeScore: axis.compositeScore,
                tier: axis.tier,
                meta: { sourceUserId },
            },
        });
    }
    catch (error) {
        console.warn('Vouch signal persistence failed', error);
    }
    return {
        targetUserId,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
        category: axis.category,
    };
};
exports.vouchForUser = vouchForUser;
const recordWhatsAppChannelSignal = async (userId, payload) => {
    const axis = await (0, exports.computePassportScore)(userId, 'general');
    const scoreDelta = Number(payload.scoreDelta || 0);
    const category = payload.signalCategory || 'general';
    try {
        await prisma.whatsAppChannelSignal.create({
            data: {
                userId,
                signalCategory: category,
                scoreDelta,
                newCompositeScore: axis.compositeScore,
                tier: axis.tier,
                meta: payload.meta || undefined,
            },
        });
    }
    catch (error) {
        console.warn('WhatsApp signal persistence failed', error);
    }
    return {
        userId,
        signalCategory: category,
        scoreDelta,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
    };
};
exports.recordWhatsAppChannelSignal = recordWhatsAppChannelSignal;
const recordSocialGraphSignal = async (userId, payload) => {
    const axis = await (0, exports.computePassportScore)(userId, 'general');
    const scoreDelta = Number(payload.scoreDelta || 0);
    const category = payload.signalCategory || 'social';
    try {
        await prisma.socialGraphSignal.create({
            data: {
                userId,
                sourceUserId: payload.sourceUserId || null,
                signalCategory: category,
                scoreDelta,
                newCompositeScore: axis.compositeScore,
                tier: axis.tier,
                meta: payload.meta || undefined,
            },
        });
    }
    catch (error) {
        console.warn('Social signal persistence failed', error);
    }
    return {
        userId,
        signalCategory: category,
        scoreDelta,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
    };
};
exports.recordSocialGraphSignal = recordSocialGraphSignal;
const recordWeb3Stake = async (userId, payload) => {
    const stakeAmount = Number(payload.stakeAmount || 0);
    const axis = await (0, exports.computePassportScore)(userId, 'general');
    try {
        await prisma.web3StakeRecord.create({
            data: {
                userId,
                stakeAmount,
                stakeBonus: 0,
                newCompositeScore: axis.compositeScore,
                tier: axis.tier,
                txHash: typeof payload.meta === 'string' ? payload.meta : undefined,
            },
        });
    }
    catch (error) {
        console.warn('Web3 stake persistence failed', error);
    }
    return {
        userId,
        stakeAmount,
        stakeBonus: 0,
        newCompositeScore: axis.compositeScore,
        tier: axis.tier,
    };
};
exports.recordWeb3Stake = recordWeb3Stake;
const exportPassport = async (userId) => {
    const passport = await (0, exports.getMyPassport)(userId);
    return {
        exportedAt: new Date().toISOString(),
        passport,
        schemaVersion: '2026-07-20-passport-risk-v1',
    };
};
exports.exportPassport = exportPassport;
async function calculateDynamicEscrow(input) {
    const axis = await (0, exports.computePassportScore)(input.userId, input.category);
    const score = Math.max(0, Math.min(1000, axis.compositeScore));
    const tier = axis.tier;
    const basePercent = Math.max(0, (1000 - score) / 20);
    const tierFloor = tier === 'PLATINUM' ? 5 : tier === 'ELITE' || score >= 950 ? 0 : null;
    const [stakeCount, streakRaw] = await Promise.all([
        prisma.web3StakeRecord.count({ where: { userId: input.userId } }),
        prisma.passportScoreSnapshot.count({
            where: {
                userId: input.userId,
                category: input.category,
                compositeScore: { gte: 700 },
            },
        }),
    ]);
    const streakDiscount = Math.min(15, streakRaw * 2);
    const web3Bonus = stakeCount > 0 ? 10 : 0;
    const categoryMultiplier = input.category === 'live_selling' ? 1.2 : input.category === 'freelance' ? 1.1 : 1;
    let finalPct = Math.max(tierFloor ?? 0, (basePercent * categoryMultiplier) - streakDiscount - web3Bonus);
    finalPct = Number(finalPct.toFixed(2));
    const friction = score >= 850 ? 0 : score >= 700 ? 15 : score >= 500 ? 40 : 65 + Math.min(20, input.transactionValue / 500);
    const reasons = [];
    if (tierFloor !== null && finalPct <= tierFloor)
        reasons.push(`${tier} floor applied`);
    if (streakDiscount)
        reasons.push(`${streakDiscount}% streak discount`);
    if (web3Bonus)
        reasons.push(`${web3Bonus}% Web3 bonus`);
    if (categoryMultiplier > 1)
        reasons.push(`${input.category} risk multiplier`);
    return {
        suggestedEscrowPercentage: finalPct,
        trustFrictionScore: Number(friction.toFixed(2)),
        reasoning: reasons.length ? reasons.join(', ') : 'Standard escrow curve',
    };
}
//# sourceMappingURL=passport-risk.service.js.map