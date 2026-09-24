"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentic_service_1 = require("../services/agentic.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONTROL PANEL — Run agents manually or on schedule
// ═══════════════════════════════════════════════════════════════════════════
// Run all agents for a venue
router.post('/venues/:venueId/run', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await agentic_service_1.agentOrchestrator.runAllAgents({
            agentId: `orchestrator_${req.params.venueId}_${Date.now()}`,
            agentType: 'ORCHESTRATOR',
            venueId: req.params.venueId,
            metadata: req.body,
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Agent execution failed' });
    }
});
// Run all agents for all venues
router.post('/run-all', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await agentic_service_1.agentOrchestrator.runAllVenues();
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Agent execution failed' });
    }
});
// Run specific agent type
router.post('/:agentType/run', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const context = {
            agentId: `${req.params.agentType}_${Date.now()}`,
            agentType: req.params.agentType,
            userId: req.user?.id,
            venueId: req.body.venueId,
            promoterId: req.body.promoterId,
            metadata: req.body,
        };
        let result;
        switch (req.params.agentType) {
            case 'PROMOTER_AUTON':
                result = await agentic_service_1.promoterAutonService.runLoop(context);
                break;
            case 'VENUE_BRAIN':
                result = await agentic_service_1.venueBrainService.runLoop(context);
                break;
            case 'GUEST_FINDER':
                result = await agentic_service_1.guestFinderService.runLoop(context);
                break;
            case 'REVENUE_MAX':
                result = await agentic_service_1.revenueMaxService.runLoop(context);
                break;
            default:
                return res.status(400).json({ error: 'Unknown agent type' });
        }
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Agent execution failed' });
    }
});
exports.default = router;
//# sourceMappingURL=agentic.routes.js.map