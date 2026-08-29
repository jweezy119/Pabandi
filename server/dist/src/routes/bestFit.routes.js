"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bestFitEngine_service_1 = require("../services/ai/bestFitEngine.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/best-fit/search
 * Finds the best fit gig workers for a specific shift.
 */
router.post('/search', async (req, res) => {
    try {
        const { scheduledDate, skills, limit, weights } = req.body;
        if (!scheduledDate) {
            return res.status(400).json({ error: 'scheduledDate is required' });
        }
        const matches = await bestFitEngine_service_1.bestFitEngineService.predictBestFit({
            scheduledDate: new Date(scheduledDate),
            skills: skills || [],
            limit: limit || 10,
            weights,
        });
        return res.json({
            success: true,
            matches,
        });
    }
    catch (error) {
        logger_1.logger.error(`[BestFitRoutes] Search error: ${error.message}`);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=bestFit.routes.js.map