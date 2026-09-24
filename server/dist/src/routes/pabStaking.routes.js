"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pabStaking_service_1 = require("../services/pabStaking.service");
const logger_1 = require("../utils/logger");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/pab-staking/stake
 * Stake PAB tokens to boost trust score
 * Body: { tier: 'SILVER' | 'GOLD' | 'PLATINUM' }
 */
router.post('/stake', auth_middleware_1.authenticate, async (req, res) => {
    const { tier } = req.body;
    if (!tier || !['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
        return res.status(400).json({ success: false, error: 'Valid tier required: BRONZE, SILVER, GOLD, or PLATINUM' });
    }
    try {
        const result = await pabStaking_service_1.pabStakingService.stakePab(req.user.id, tier);
        return res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[PabStakingRoutes] /stake error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/pab-staking/unstake
 * Unstake PAB after lock period
 * Body: { stakingId: string }
 */
router.post('/unstake', auth_middleware_1.authenticate, async (req, res) => {
    const { stakingId } = req.body;
    if (!stakingId) {
        return res.status(400).json({ success: false, error: 'stakingId is required' });
    }
    try {
        const result = await pabStaking_service_1.pabStakingService.unstakePab(req.user.id, stakingId);
        return res.status(result.success ? 200 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[PabStakingRoutes] /unstake error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/pab-staking/status
 * Get user's staking status and tiers
 */
router.get('/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const status = await pabStaking_service_1.pabStakingService.getStakingStatus(req.user.id);
        return res.json({ success: true, data: status });
    }
    catch (error) {
        logger_1.logger.error('[PabStakingRoutes] /status error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/pab-staking/tiers
 * Get available staking tiers (public)
 */
router.get('/tiers', async (_req, res) => {
    return res.json({
        success: true,
        data: pabStaking_service_1.pabStakingService.STAKE_TIERS,
    });
});
exports.default = router;
//# sourceMappingURL=pabStaking.routes.js.map