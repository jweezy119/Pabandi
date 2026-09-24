"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeeOffset = exports.calculateRewards = exports.getRewardTiers = exports.getRewardHistory = exports.getRewardBalance = void 0;
const rewardEngine_service_1 = require("../services/rewardEngine.service");
const database_1 = require("../utils/database");
const getRewardBalance = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const balance = await database_1.prisma.userRewardBalance.findUnique({ where: { userId } });
        const tier = await rewardEngine_service_1.rewardEngine.getUserTier(userId, balance?.userType || 'CUSTOMER');
        res.json({
            success: true,
            balance: balance || { totalEarned: 0, totalClaimed: 0, currentTier: 'Bronze', stakedAmount: 0 },
            tier,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getRewardBalance = getRewardBalance;
const getRewardHistory = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const history = await database_1.prisma.rewardTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, history });
    }
    catch (err) {
        next(err);
    }
};
exports.getRewardHistory = getRewardHistory;
const getRewardTiers = async (req, res, next) => {
    try {
        const tiers = await database_1.prisma.rewardTier.findMany({
            where: { isActive: true },
            orderBy: { minStake: 'asc' },
        });
        res.json({ success: true, tiers });
    }
    catch (err) {
        next(err);
    }
};
exports.getRewardTiers = getRewardTiers;
const calculateRewards = async (req, res, next) => {
    try {
        const { purchaseAmount } = req.body;
        const userId = req.user?.id;
        let multiplier = 1.0;
        if (userId) {
            const tier = await rewardEngine_service_1.rewardEngine.getUserTier(userId, 'CUSTOMER');
            multiplier = tier.rewardMultiplier || 1.0;
        }
        const rewards = rewardEngine_service_1.rewardEngine.calculateRewards(purchaseAmount, multiplier);
        res.json({ success: true, rewards });
    }
    catch (err) {
        next(err);
    }
};
exports.calculateRewards = calculateRewards;
const getFeeOffset = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { originalFee } = req.body;
        const balance = await database_1.prisma.userRewardBalance.findUnique({ where: { userId } });
        const offset = await rewardEngine_service_1.rewardEngine.calculateFeeOffset(userId, balance?.userType || 'CUSTOMER', originalFee);
        res.json({ success: true, offset });
    }
    catch (err) {
        next(err);
    }
};
exports.getFeeOffset = getFeeOffset;
//# sourceMappingURL=reward.controller.js.map