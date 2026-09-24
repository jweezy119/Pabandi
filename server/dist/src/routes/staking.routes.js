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
const express_1 = require("express");
const pabTokenStaking_service_1 = require("../services/pabTokenStaking.service");
const trustArbitrator_service_1 = require("../services/trustArbitrator.service");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── $PAB Staking Routes ──────────────────────────────────────────
/**
 * POST /api/v1/staking/stake
 * Stake $PAB tokens to earn trust score multipliers.
 *
 * Body: { amount: number, txHash?: string }
 * Returns: { success, userId, amount, tier, multiplier, totalStaked, estimatedDailyReward }
 */
router.post('/stake', auth_middleware_1.authenticate, async (req, res) => {
    const amount = Number(req.body.amount);
    const txHash = req.body.txHash;
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }
    try {
        const result = await pabTokenStaking_service_1.pabTokenStakingService.stakeTokens(req.user.id, amount, txHash);
        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /stake error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/staking/unstake
 * Unstake $PAB tokens (may incur slashing penalty).
 *
 * Body: { positionId: string }
 * Returns: { success, userId, amount, multiplier, totalStaked, slashingPenalty }
 */
router.post('/unstake', auth_middleware_1.authenticate, async (req, res) => {
    const { positionId } = req.body;
    if (!positionId) {
        return res.status(400).json({ success: false, error: 'positionId is required' });
    }
    try {
        const result = await pabTokenStaking_service_1.pabTokenStakingService.unstakeTokens(req.user.id, positionId);
        return res.status(result.success ? 200 : 400).json({
            success: result.success,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /unstake error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/staking/positions
 * Get all staking positions for the authenticated user.
 */
router.get('/positions', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const positions = await database_1.prisma.stakingPosition.findMany({
            where: { userId: req.user.id },
        });
        const { multiplier, totalStaked, tier } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(req.user.id);
        const estimatedDailyReward = Number((totalStaked * 0.12 / 365).toFixed(8));
        return res.json({
            success: true,
            data: {
                positions,
                totalStaked,
                tier,
                multiplier,
                estimatedDailyReward,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /positions error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/staking/multiplier/:userId
 * Public endpoint to check a user's staking multiplier.
 */
router.get('/multiplier/:userId', async (req, res) => {
    try {
        const { multiplier, totalStaked, tier } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(req.params.userId);
        return res.json({
            success: true,
            data: { multiplier, totalStaked, tier },
        });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /multiplier error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/staking/deposit-multiplier/:userId
 * Get the effective deposit after applying the staking multiplier.
 */
router.get('/deposit-multiplier/:userId', async (req, res) => {
    const baseDeposit = Number(req.query.baseDeposit || 10);
    try {
        const result = await pabTokenStaking_service_1.pabTokenStakingService.getEffectiveDeposit(req.params.userId, baseDeposit);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /deposit-multiplier error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/staking/me/earnings
 * Get user's wallet balance, trust multiplier, and recent minting history.
 */
router.get('/me/earnings', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        // 1. Get Wallet Balance
        let wallet = await database_1.prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            wallet = await database_1.prisma.wallet.create({ data: { userId, balance: 0 } });
        }
        // 2. Get Trust Multiplier & Velocity
        const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../services/trustFlux.service')));
        const flux = await trustFluxService.computeTrustFlux(userId);
        const { multiplier, tier, totalStaked } = await pabTokenStaking_service_1.pabTokenStakingService.getTrustMultiplier(userId);
        // Compute the current velocity multiplier they would get if they minted today
        const MIN_VELOCITY_MULT = 0.5;
        const MAX_VELOCITY_MULT = 2.0;
        const velocityMult = MIN_VELOCITY_MULT + ((flux.velocity + 1) / 2) * (MAX_VELOCITY_MULT - MIN_VELOCITY_MULT);
        // 3. Get Recent Earnings History
        const history = await database_1.prisma.trustAuditTrail.findMany({
            where: {
                userId,
                changeReason: { startsWith: 'PABOND_MINT_' }
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return res.json({
            success: true,
            data: {
                balancePAB: wallet.balance,
                totalStaked,
                tier,
                stakingMultiplier: multiplier,
                trustVelocity: Math.round(flux.velocity * 1000) / 1000,
                velocityMultiplier: Math.round(velocityMult * 1000) / 1000,
                history
            }
        });
    }
    catch (error) {
        logger_1.logger.error('[Staking] /me/earnings error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
// ── AI Trust Arbitrator Routes ───────────────────────────────────
/**
 * POST /api/v1/arbitrator/dispute
 * Submit a dispute for AI arbitration.
 *
 * Body: DisputeEvidence
 * Returns: { success, data: ArbitrationResult }
 */
router.post('/arbitrator/dispute', async (req, res) => {
    const evidence = req.body;
    if (!evidence.disputeId || !evidence.claimAmount || !evidence.bookingDetails) {
        return res.status(400).json({
            success: false,
            error: 'disputeId, claimAmount, and bookingDetails are required',
        });
    }
    try {
        const result = await trustArbitrator_service_1.trustArbitratorService.arbitrate(evidence);
        // Record the arbitration result
        const disputeUpdate = {
            outcome: result.needsHumanReview ? 'PENDING' : 'RESOLVED',
            stakedAmount: Number(result.pabSlash?.amount || 0),
            evidenceUrls: result.pabSlash ? [JSON.stringify(result.pabSlash)] : [],
        };
        await database_1.prisma.dispute.update({
            where: { id: evidence.disputeId },
            data: disputeUpdate,
        });
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Arbitrator] /dispute error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/arbitrator/tiers
 * Get staking tier configuration for $PAB trust multipliers.
 */
router.get('/arbitrator/tiers', (_req, res) => {
    return res.json({
        success: true,
        data: {
            tiers: {
                BRONZE: { min: 0, multiplier: 1.0 },
                SILVER: { min: 100, multiplier: 1.3 },
                GOLD: { min: 500, multiplier: 1.8 },
                PLATINUM: { min: 2000, multiplier: 2.5 },
            },
            slashRates: {
                NO_SHOW: 0.15,
                DISPUTE_LOST: 0.10,
                FRAUD: 0.50,
                LATE_CANCELLATION: 0.05,
            },
            rewardRates: {
                COMPLETED_BOOKING: 0.5,
                POSITIVE_REVIEW: 0.2,
                ON_TIME_RATE: 1.0,
                STREAK_BONUS: 5.0,
            },
            humanEscalationThresholdUSD: 500,
            highConfidenceThreshold: 0.85,
        },
    });
});
/**
 * GET /api/v1/staking/pabond/stats
 * Returns Pabond bonding curve statistics: price, APY, TVL, daily volume,
 * top 10 velocity leaders. Public endpoint.
 */
router.get('/pabond/stats', async (_req, res) => {
    try {
        const { pabondService } = await Promise.resolve().then(() => __importStar(require('../services/pabond.service')));
        const stats = await pabondService.getStats();
        res.json({ success: true, data: stats });
    }
    catch (err) {
        logger_1.logger.error(`[StakingRoutes] pabond/stats error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=staking.routes.js.map