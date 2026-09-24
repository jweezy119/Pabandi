"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentLearningRoutes = void 0;
const express_1 = require("express");
const agentLearning_service_1 = require("../services/agentLearning.service");
exports.agentLearningRoutes = (0, express_1.Router)();
// Get learning state for an agent (best variant + history + feedback)
exports.agentLearningRoutes.get('/:agentId/learning', async (req, res) => {
    try {
        const state = await agentLearning_service_1.agentLearningService.getAgentLearningState(req.params.agentId);
        if (!state)
            return res.status(404).json({ message: 'Agent not found' });
        res.json(state);
    }
    catch (e) {
        res.status(500).json({ message: e.message });
    }
});
// Submit feedback for a completed booking
exports.agentLearningRoutes.post('/:agentId/feedback', async (req, res) => {
    try {
        const { outcome, revenue, rating, tags, bookingId } = req.body || {};
        if (!['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(outcome))
            return res.status(422).json({ message: 'outcome must be COMPLETED|NO_SHOW|CANCELLED' });
        const result = await agentLearning_service_1.agentLearningService.recordLearningEvent({
            agentId: req.params.agentId,
            outcome,
            revenue,
            rating: Math.min(5, Math.max(1, rating || 3)),
            tags,
            bookingId,
        });
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ message: e.message });
    }
});
//# sourceMappingURL=agentLearning.routes.js.map