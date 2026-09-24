"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentReward_service_1 = require("../services/agentReward.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/agent-rewards/distribute
 * Distribute PAB reward to agent for completed task
 * Body: { agentId: string, taskType: string, taskValue: number }
 */
router.post('/distribute', auth_middleware_1.authenticate, async (req, res) => {
    const { agentId, taskType, taskValue } = req.body;
    if (!agentId || !taskType || !taskValue) {
        return res.status(400).json({ success: false, error: 'agentId, taskType, and taskValue are required' });
    }
    if (typeof taskValue !== 'number' || taskValue <= 0) {
        return res.status(400).json({ success: false, error: 'taskValue must be a positive number' });
    }
    try {
        const result = await agentReward_service_1.agentRewardService.distributeAgentReward({
            agentId,
            taskType,
            taskValue,
            userId: req.user.id,
        });
        return res.status(result.success ? 201 : 400).json(result);
    }
    catch (error) {
        logger_1.logger.error('[AgentRewardRoutes] /distribute error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/agent-rewards/:agentId
 * Get all rewards for an agent
 */
router.get('/:agentId', async (req, res) => {
    try {
        const result = await agentReward_service_1.agentRewardService.getAgentRewards(req.params.agentId);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[AgentRewardRoutes] /:agentId error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/agent-rewards/user/me
 * Get current user's rewards
 */
router.get('/user/me', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await agentReward_service_1.agentRewardService.getUserRewards(req.user.id);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[AgentRewardRoutes] /user/me error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/agent-rewards/config/rates
 * Get reward rate configuration (public)
 */
router.get('/config/rates', async (_req, res) => {
    return res.json({
        success: true,
        data: {
            rewardRate: agentReward_service_1.agentRewardService.REWARD_RATE,
            rewardPercent: `${agentReward_service_1.agentRewardService.REWARD_RATE * 100}%`,
            description: 'Agents earn 2% of task value in PAB',
        },
    });
});
exports.default = router;
//# sourceMappingURL=agentReward.routes.js.map