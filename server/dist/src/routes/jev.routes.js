"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jevDecision_service_1 = require("../services/jevDecision.service");
const router = (0, express_1.Router)();
// Agent trading decisions
router.post('/trading-decision/:agentId', async (req, res) => {
    try {
        const result = await jevDecision_service_1.jevDecision.getTradingDecision(req.params.agentId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Tenant risk assessment
router.post('/tenant-risk/:tenantId', async (req, res) => {
    try {
        const result = await jevDecision_service_1.jevDecision.getTenantRiskAssessment(req.params.tenantId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Payment routing
router.post('/payment-route/:userId', async (req, res) => {
    try {
        const { amount } = req.body;
        const result = await jevDecision_service_1.jevDecision.getPaymentRoute(req.params.userId, amount);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Agent quality score
router.post('/agent-quality/:agentId', async (req, res) => {
    try {
        const result = await jevDecision_service_1.jevDecision.getAgentQualityScore(req.params.agentId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Generic decision
router.post('/decide', async (req, res) => {
    try {
        const { state, questions } = req.body;
        const result = await jevDecision_service_1.jevDecision.decide(state, questions);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=jev.routes.js.map