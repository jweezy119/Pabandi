"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_service_1 = require("../services/agent.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// POST /api/v1/agents/spawn
router.post('/spawn', async (req, res) => {
    try {
        const { userPhone, targetPhone, budget, goal, trustScore } = req.body;
        if (!userPhone || !targetPhone || !budget || !goal) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const response = await agent_service_1.agentService.spawnAgent(userPhone, targetPhone, Number(budget), goal, Number(trustScore || 50));
        res.json({ success: true, data: response });
    }
    catch (error) {
        logger_1.logger.error(`[Agent Routes] Error spawning agent: ${error.message}`);
        res.status(500).json({ error: 'Failed to spawn agent' });
    }
});
exports.default = router;
//# sourceMappingURL=agent.routes.js.map